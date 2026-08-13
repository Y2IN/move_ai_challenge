/**
 * 편익 · 비용 · 보조금 계산.
 *
 * 기준선(baseline) = 전 구간 도로 직행
 * 실제(actual)     = 양단 셔틀(공장↔역) 도로 + 간선 철도
 * 편익             = baseline − actual
 *
 * 숫자는 전부 BE/src/constants.ts 에서만 옵니다. 이 파일에 리터럴 계수를 쓰지 마세요.
 */

import {
  CARBON_PRICE_IN_USE,
  CO2_G_PER_TON_KM,
  EMPTY_WAGON_DISCOUNT_RATE,
  FARE_KRW_PER_TON_KM,
  HANDLING_KRW_PER_TON,
  minBillableTonRate,
  MODAL_SHIFT_UNIT_COST_IN_USE,
  PINE_CO2_KG_PER_TREE_YEAR,
  SHUTTLE_FARE_MULTIPLIER,
  SOCIAL_COST_KRW_PER_TON_KM,
  SOURCES,
  SUBSIDY,
  TRUCK_CAPACITY_TON,
} from "./constants";
import type {
  BenefitItem,
  BenefitResult,
  CalcResult,
  CostResult,
  LegVolumes,
  MemberShare,
  SubsidyResult,
} from "./types";

/** 화주별 분담 계산에 필요한 최소 정보 */
export interface MemberInput {
  shipmentId: string;
  shipperName: string;
  weightTon: number;
  /** 양단 셔틀 거리 합계 (km) — 화주마다 공장 위치가 다릅니다 */
  shuttleKm: number;
  /** 이 화주가 지금 내고 있는 도로 운임 (원) — 상한 보장의 기준선 */
  currentRoadFareKrw: number;
}

/** 계산 입력 — 매칭 결과(합적 편성 1건)를 이 형태로 정규화해서 넘깁니다. */
export interface CalcInput {
  /** 편성에 실린 총 중량 (톤) */
  totalTon: number;
  /** 철도 간선 거리 (km) */
  railDistanceKm: number;
  /** 도로 직행 거리 (km) — baseline */
  roadDirectDistanceKm: number;
  /** 양단 셔틀 거리 합계 (km) — 출발지→역 + 역→도착지 */
  shuttleDistanceKm: number;
  /** 화차 정원 (톤) — 최저톤수 부과 기준이자 적재율 분모입니다. */
  wagonCapacityTon: number;
  /** 편성에 참여한 화주 수. 합적 전(각자 화차 1량씩) 비용 계산에 씁니다. */
  memberCount: number;
  /** 화주별 분담을 계산하려면 넘깁니다. 없으면 편성 합계만 나옵니다. */
  members?: MemberInput[];
  /** 화주들이 지금 내고 있는 도로 운임 실측 합계 (원). 없으면 원단위로 추정합니다. */
  actualRoadFareKrw?: number;
  /** 이 편성의 수송 횟수 (분기 실적 집계 시 사용). 기본 1. */
  trips?: number;
  /** 품목 — 최저톤수율이 품목별로 다릅니다. 없으면 기본값(중앙값)을 씁니다. */
  itemCategory?: string;
}

const round = (n: number) => Math.round(n);

// ── 1. 물리량 ──────────────────────────────────────────────────

export function computeVolumes(input: CalcInput): LegVolumes {
  const trips = input.trips ?? 1;
  const t = input.totalTon * trips;
  return {
    roadDirectTonKm: t * input.roadDirectDistanceKm,
    railTonKm: t * input.railDistanceKm,
    shuttleTonKm: t * input.shuttleDistanceKm,
  };
}

// ── 2. 사회·환경 편익 ──────────────────────────────────────────

export function computeBenefit(input: CalcInput): BenefitResult {
  const v = computeVolumes(input);

  // 온실가스 — 셔틀은 도로 계수를 그대로 씁니다.
  const roadCo2Ton = (v.roadDirectTonKm * CO2_G_PER_TON_KM.road) / 1_000_000;
  const railCo2Ton =
    (v.railTonKm * CO2_G_PER_TON_KM.rail +
      v.shuttleTonKm * CO2_G_PER_TON_KM.road) /
    1_000_000;
  const co2ReducedTon = roadCo2Ton - railCo2Ton;

  const items: BenefitItem[] = [
    {
      key: "ghg",
      label: "온실가스 감축",
      quantity: `${co2ReducedTon.toFixed(1)} tCO₂eq`,
      amountKrw: round(co2ReducedTon * CARBON_PRICE_IN_USE),
      source: SOURCES.co2,
    },
  ];

  // 대기오염 · 사고 · 혼잡 · 도로유지 — 전부 같은 형태로 계산됩니다.
  const socialItems = [
    { key: "airPollution", label: "대기오염 저감", quantity: "NOx·SOx·PM2.5" },
    {
      key: "accident",
      label: "교통사고 예방",
      quantity: "대형화물차 주행 감소",
    },
    { key: "congestion", label: "도로혼잡 완화", quantity: "차량·km 감소분" },
    { key: "roadWear", label: "도로유지비 절감", quantity: "포장 손상 감소" },
  ] as const;

  for (const item of socialItems) {
    const rate = SOCIAL_COST_KRW_PER_TON_KM[item.key];
    const baseline = v.roadDirectTonKm * rate.road;
    const actual = v.railTonKm * rate.rail + v.shuttleTonKm * rate.road;
    items.push({
      key: item.key,
      label: item.label,
      quantity: item.quantity,
      amountKrw: round(baseline - actual),
      source: SOURCES.socialCost,
    });
  }

  const totalBenefitKrw = items.reduce((sum, i) => sum + i.amountKrw, 0);
  const trips = input.trips ?? 1;

  return {
    volumes: v,
    roadCo2Ton,
    railCo2Ton,
    co2ReducedTon,
    co2ReducedRate: roadCo2Ton > 0 ? co2ReducedTon / roadCo2Ton : 0,
    items,
    totalBenefitKrw,
    pineTrees: round((co2ReducedTon * 1000) / PINE_CO2_KG_PER_TREE_YEAR),
    truckLoadsAvoided: Math.ceil((input.totalTon * trips) / TRUCK_CAPACITY_TON),
  };
}

// ── 3. 비용 ────────────────────────────────────────────────────

export function computeCost(input: CalcInput): CostResult {
  const v = computeVolumes(input);
  const trips = input.trips ?? 1;
  const totalTon = input.totalTon * trips;

  // baseline — 화주 실측 운임이 있으면 그걸 쓰고, 없으면 원단위로 추정.
  // 실측 운임은 **편성 1회분**이므로 수송 횟수를 곱해야 철도 비용과 층위가 맞습니다.
  // (곱하지 않으면 trips > 1 일 때 추가비용이 통째로 틀립니다)
  const roadOnlyKrw = input.actualRoadFareKrw
    ? round(input.actualRoadFareKrw * trips)
    : round(v.roadDirectTonKm * FARE_KRW_PER_TON_KM.road);
  // 참고용 — 만재 트럭 원단위로 환산한 벤치마크. 소량 화물은 실측이 이것보다 훨씬 비쌉니다.
  const roadBenchmarkKrw = round(v.roadDirectTonKm * FARE_KRW_PER_TON_KM.road);

  // 최저톤수 — 화차 1량의 운임계산톤수는 실적재량과 최저톤수 중 **큰 쪽**입니다.
  //   운임계산톤수 = max(실적재톤수, 화차표기하중톤수 × 품목별 최저톤수율)
  // 최저톤수율은 100%가 아니라 품목별 30~100% 차등입니다(기본값 = 실측 중앙값 80%).
  // 최저톤수만 쓰면 만재 화차가 실제보다 적게 부과되어 철도 비용이 과소 산정됩니다.
  const minBillableTon = input.wagonCapacityTon * minBillableTonRate(input.itemCategory);
  const perTonKmKrw = input.railDistanceKm * FARE_KRW_PER_TON_KM.railLineHaul;

  const handlingKrw = round(totalTon * HANDLING_KRW_PER_TON);
  const shuttleKrw = round(
    v.shuttleTonKm * FARE_KRW_PER_TON_KM.road * SHUTTLE_FARE_MULTIPLIER,
  );

  // 합적 후 — 화차 1량에 전원이 타므로 운임계산톤수는 편성 총량 기준입니다.
  // 복귀 공차라 간선 운임 할인까지 받습니다.
  const pooledBillableTon = Math.max(input.totalTon, minBillableTon);
  const railLineHaulKrw = round(
    pooledBillableTon * perTonKmKrw * trips * (1 - EMPTY_WAGON_DISCOUNT_RATE),
  );
  const railPooledKrw = railLineHaulKrw + handlingKrw + shuttleKrw;

  // 합적 전 — 화주가 **각자** 화차 1량씩 잡습니다. 화주마다 실적재량이 다르므로
  // 운임계산톤수도 각자 max(본인 톤수, 최저톤수)로 따로 구해서 합칩니다.
  // members 를 안 넘기면 전원이 최저톤수만 낸다고 보수적으로 근사합니다.
  const soloBillableTon = input.members
    ? input.members.reduce((a, m) => a + Math.max(m.weightTon, minBillableTon), 0)
    : minBillableTon * input.memberCount;
  const railSoloKrw =
    round(soloBillableTon * perTonKmKrw * trips) + handlingKrw + shuttleKrw;

  const poolingSavingKrw = railSoloKrw - railPooledKrw;

  return {
    roadOnlyKrw,
    roadBenchmarkKrw,
    railSoloKrw,
    railPooledKrw,
    breakdown: { railLineHaulKrw, handlingKrw, shuttleKrw },
    poolingSavingKrw,
    poolingSavingRate: railSoloKrw > 0 ? poolingSavingKrw / railSoloKrw : 0,
  };
}

// ── 4. 전환교통 보조금 ─────────────────────────────────────────

/**
 * 전환교통 지원사업 보조금 = min(신청액 C, 상한액 G)
 *
 * 한국철도물류협회 별지 제3호 서식(보조금 신청총액 산출내역서) 산식을 그대로 따릅니다.
 *
 *   A (수단전환 추가비용) = 철도운송비용 − 도로운송비용
 *   D (도로 시 사회·환경비용) = 물량 × 도로거리 × 도로원단위
 *   F (철도 시 사회·환경비용) = 물량 × 철도거리 × 철도원단위
 *                             + 물량 × 셔틀거리 × **도로**원단위
 *   G (상한액) = (D − F) × 30%
 *   H (신청총액) = min(A, G)
 *
 * ⚠️ 30% 를 곱하는 대상은 편익 **총액**이 아니라 **절감액(D − F)** 입니다.
 *    그리고 셔틀 구간은 도로 원단위로 철도 측에 가산됩니다.
 *    둘 중 하나만 틀려도 상한액이 과대 산정됩니다.
 *
 * ⚠️ 추가비용이 0 이하면(= 철도가 도로보다 싸면) 보조금 대상이 아닙니다.
 *    "철도가 도로보다 싸다"와 "보조금을 받는다"는 동시에 주장할 수 없습니다.
 */
export function computeSubsidy(
  cost: CostResult,
  benefit: BenefitResult,
): SubsidyResult {
  const additionalCostKrw = cost.railPooledKrw - cost.roadOnlyKrw;

  // 공식 원단위로 절감액(D − F)을 다시 계산합니다.
  // benefit.items 의 4개 항목 합계는 표시용 추정치라 여기에 쓰지 않습니다.
  const v = benefit.volumes;
  const u = MODAL_SHIFT_UNIT_COST_IN_USE;
  const roadSocialKrw = v.roadDirectTonKm * u.road;
  const railSocialKrw = v.railTonKm * u.rail + v.shuttleTonKm * u.road;
  const socialSavingKrw = roadSocialKrw - railSocialKrw;
  // 절감액이 음수일 수 있습니다(셔틀 거리가 길어 철도 쪽 사회비용이 더 큰 노선).
  // 그대로 두면 min(A, B) 가 음수 보조금을 만들어 화주 부담이 **늘어납니다**.
  const benefitCapKrw = Math.max(0, round(socialSavingKrw * SUBSIDY.benefitCapRate));

  const eligible = additionalCostKrw > 0 && benefitCapKrw > 0;
  const subsidyKrw = eligible
    ? Math.max(0, Math.min(additionalCostKrw, benefitCapKrw))
    : 0;

  const adopted: SubsidyResult["adopted"] = !eligible
    ? "none"
    : additionalCostKrw < benefitCapKrw
      ? "additionalCost"
      : "benefitCap";

  const netCostKrw = cost.railPooledKrw - subsidyKrw;

  return {
    additionalCostKrw,
    benefitCapKrw,
    subsidyKrw,
    adopted,
    eligible,
    netCostKrw,
    socialSavingKrw: round(socialSavingKrw),
    roadSocialKrw: round(roadSocialKrw),
    railSocialKrw: round(railSocialKrw),
    vsRoadKrw: cost.roadOnlyKrw - netCostKrw,
    note: eligible
      ? `추가비용 ${additionalCostKrw.toLocaleString()}원과 편익의 30%인 ${benefitCapKrw.toLocaleString()}원 중 작은 값을 신청합니다.`
      : "철도 합적 비용이 도로 직행보다 낮아 전환 추가비용이 발생하지 않습니다. 보조금 대상이 아니며, 편익은 ESG 공시 자산으로만 활용합니다.",
  };
}

// ── 5. 화주별 분담 ─────────────────────────────────────────────

/**
 * 편성 비용을 화주별로 나눕니다.
 *
 * 간선운임은 **화차 1량 고정비**라 적재량과 무관하게 같은 금액이 나옵니다.
 * 그래서 몇 톤이 모이느냐에 따라 톤당 단가가 크게 달라집니다.
 * (18톤 화차에 6톤만 실으면 톤당 단가가 만재 대비 3배)
 *
 * 등록 시점에는 최종 적재율을 알 수 없으므로 **도로 운임을 상한으로 보장**합니다.
 * 화주는 최악의 경우에도 지금보다 더 내지 않고, 많이 모일수록 싸집니다.
 */
export function allocate(
  members: MemberInput[],
  cost: CostResult,
  input: CalcInput,
): MemberShare[] {
  const trips = input.trips ?? 1;
  const totalTon = members.reduce((a, m) => a + m.weightTon, 0);
  if (totalTon <= 0) return [];

  return members.map((m) => {
    const shareRate = m.weightTon / totalTon;

    // 간선운임 — 화차 1량 고정비를 톤수 비례로 분담
    const railLineHaulKrw = round(cost.breakdown.railLineHaulKrw * shareRate);
    // 상하역비 — 자기 톤수만큼
    const handlingKrw = round(m.weightTon * trips * HANDLING_KRW_PER_TON);
    // 셔틀비 — 공장 위치가 화주마다 다르므로 자기 거리로
    const shuttleKrw = round(
      m.weightTon *
        m.shuttleKm *
        trips *
        FARE_KRW_PER_TON_KM.road *
        SHUTTLE_FARE_MULTIPLIER,
    );

    const totalKrw = railLineHaulKrw + handlingKrw + shuttleKrw;

    // 상한 보장 — 도로 운임을 넘겨 청구하지 않습니다.
    // 분담액은 trips 만큼 커지므로 도로 운임도 같은 층위(× trips)로 맞춥니다.
    // 안 맞추면 trips > 1 일 때 전원이 상한에 걸려 플랫폼이 존재하지 않는 금액을 흡수합니다.
    const roadFareKrw = round(m.currentRoadFareKrw * trips);
    const capped = roadFareKrw > 0 && totalKrw > roadFareKrw;
    const billedKrw = capped ? roadFareKrw : totalKrw;

    return {
      shipmentId: m.shipmentId,
      shipperName: m.shipperName,
      weightTon: m.weightTon,
      shareRate,
      railLineHaulKrw,
      handlingKrw,
      shuttleKrw,
      totalKrw,
      roadFareKrw,
      billedKrw,
      absorbedKrw: capped ? totalKrw - roadFareKrw : 0,
      // 도로 운임을 모르면(등록 폼에서 생략) 절감액을 계산할 수 없습니다.
      // 0 − 분담액 = 큰 음수가 나와 화면에 "절감 −234,333원"으로 찍힙니다.
      savingKrw: roadFareKrw > 0 ? roadFareKrw - billedKrw : 0,
      savingRate: roadFareKrw > 0 ? (roadFareKrw - billedKrw) / roadFareKrw : 0,
    };
  });
}

// ── 6. 한 번에 ─────────────────────────────────────────────────

export function calculate(input: CalcInput): CalcResult {
  const benefit = computeBenefit(input);
  const cost = computeCost(input);
  const subsidy = computeSubsidy(cost, benefit);
  const shares = input.members ? allocate(input.members, cost, input) : [];
  return { benefit, cost, subsidy, shares };
}
