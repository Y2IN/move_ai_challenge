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
  MIN_BILLABLE_LOAD_RATIO,
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
  SubsidyResult,
} from "./types";

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
  /** 화주들이 지금 내고 있는 도로 운임 실측 합계 (원). 없으면 원단위로 추정합니다. */
  actualRoadFareKrw?: number;
  /** 이 편성의 수송 횟수 (분기 실적 집계 시 사용). 기본 1. */
  trips?: number;
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
    (v.railTonKm * CO2_G_PER_TON_KM.rail + v.shuttleTonKm * CO2_G_PER_TON_KM.road) / 1_000_000;
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
    { key: "accident", label: "교통사고 예방", quantity: "대형화물차 주행 감소" },
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

  // baseline — 화주 실측 운임이 있으면 그걸 쓰고, 없으면 원단위로 추정
  const roadOnlyKrw =
    input.actualRoadFareKrw ?? round(v.roadDirectTonKm * FARE_KRW_PER_TON_KM.road);
  // 참고용 — 만재 트럭 원단위로 환산한 벤치마크. 소량 화물은 실측이 이것보다 훨씬 비쌉니다.
  const roadBenchmarkKrw = round(v.roadDirectTonKm * FARE_KRW_PER_TON_KM.road);

  // 최저톤수 — 화차 1량을 잡으면 실적재량과 무관하게 정원 기준으로 부과됩니다.
  const billableTonPerWagon = input.wagonCapacityTon * MIN_BILLABLE_LOAD_RATIO;
  const lineHaulPerWagon =
    billableTonPerWagon * input.railDistanceKm * FARE_KRW_PER_TON_KM.railLineHaul;

  const handlingKrw = round(totalTon * HANDLING_KRW_PER_TON);
  const shuttleKrw = round(
    v.shuttleTonKm * FARE_KRW_PER_TON_KM.road * SHUTTLE_FARE_MULTIPLIER,
  );

  // 합적 후 — 화차 1량을 나눠 쓰고, 복귀 공차라 간선 운임 할인까지 받습니다.
  const railLineHaulKrw = round(
    lineHaulPerWagon * trips * (1 - EMPTY_WAGON_DISCOUNT_RATE),
  );
  const railPooledKrw = railLineHaulKrw + handlingKrw + shuttleKrw;

  // 합적 전 — 화주 N명이 각자 화차 1량씩 잡으므로 최저톤수를 N번 냅니다. 할인도 없습니다.
  const railSoloKrw =
    round(lineHaulPerWagon * trips * input.memberCount) + handlingKrw + shuttleKrw;

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
 * 국토교통부 고시 제2019-16호: 보조금 = min(전환 추가비용, 사회환경적 편익 × 30%)
 *
 * ⚠️ 중요 — 추가비용이 0 이하면(= 철도가 도로보다 싸면) 보조금 대상이 아닙니다.
 *    "철도가 도로보다 싸다"와 "보조금을 받는다"는 동시에 주장할 수 없습니다.
 */
export function computeSubsidy(cost: CostResult, benefit: BenefitResult): SubsidyResult {
  const additionalCostKrw = cost.railPooledKrw - cost.roadOnlyKrw;
  const benefitCapKrw = round(benefit.totalBenefitKrw * SUBSIDY.benefitCapRate);

  const eligible = additionalCostKrw > 0;
  const subsidyKrw = eligible ? Math.min(additionalCostKrw, benefitCapKrw) : 0;

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
    vsRoadKrw: cost.roadOnlyKrw - netCostKrw,
    note: eligible
      ? `추가비용 ${additionalCostKrw.toLocaleString()}원과 편익의 30%인 ${benefitCapKrw.toLocaleString()}원 중 작은 값을 신청합니다.`
      : "철도 합적 비용이 도로 직행보다 낮아 전환 추가비용이 발생하지 않습니다. 보조금 대상이 아니며, 편익은 ESG 공시 자산으로만 활용합니다.",
  };
}

// ── 5. 한 번에 ─────────────────────────────────────────────────

export function calculate(input: CalcInput): CalcResult {
  const benefit = computeBenefit(input);
  const cost = computeCost(input);
  const subsidy = computeSubsidy(cost, benefit);
  return { benefit, cost, subsidy };
}