/**
 * 계산 결과 → `ReportInput` 변환.
 *
 * **여기가 계산 레이어와 리포트 레이어의 경계다.**
 * 계산 쪽 타입(MatchResult / CalcResult)을 아는 유일한 파일이므로,
 * 계산 구조가 바뀌면 이 파일만 고치면 된다. 나머지 리포트 코드는 `ReportInput` 만 본다.
 */

import { COEFFICIENT_VERSION, MODAL_SHIFT_UNIT_COST_IN_USE, MODAL_SHIFT_YEAR, SUBSIDY } from "../constants";
import type { MatchResult } from "../matching";
import type { Station } from "../types";
import type { Applicant, ReportInput, ReportPeriod } from "./contract";

/** 확정된 편성 1건 — 분기 리포트는 이걸 여러 건 모아서 만든다. */
export interface ConfirmedTransport {
  match: MatchResult;
  /** 같은 편성이 반복 수송된 횟수. 기본 1 */
  trips?: number;
}

const sum = (ns: number[]) => ns.reduce((a, n) => a + n, 0);

const WAGON_TYPE_LABEL: Record<string, string> = {
  covered: "유개화차",
  open: "무개화차",
  container: "컨테이너",
  tank: "탱크화차",
};

export function buildReportInput(
  transports: ConfirmedTransport[],
  applicant: Applicant,
  period: ReportPeriod,
  /** 역 코드를 서식에 인쇄할 이름으로 바꾸기 위해 필요 */
  stations: Station[] = [],
): ReportInput {
  const stationName = (id: string | undefined) =>
    stations.find((s) => s.id === id)?.name ?? id ?? "?";
  const routeOf = (m: MatchResult) =>
    m.lane
      ? `${stationName(m.lane.originStationId)} → ${stationName(m.lane.destStationId)}`
      : "노선 미상";
  const usable = transports.filter((t) => t.match.calc && t.match.wagon);
  if (usable.length === 0) {
    throw new Error("확정된 편성이 없습니다. 매칭이 성립한 건만 리포트에 넣을 수 있습니다.");
  }

  // ── 2. 전환 계획 — **노선 단위**로 묶는다.
  //
  // 품목별로 행을 쪼개면 각 행에 노선 전체의 수송횟수가 들어가, 서식 2의
  // 수송횟수 열을 세로로 더했을 때 합계 행과 안 맞는다(3행 × 12회 = 36 vs 합계 12).
  // 관할 지자체에 내는 문서라 열 합계가 안 맞으면 안 된다.
  const planMap = new Map<
    string,
    {
      route: string;
      item: string;
      tons: number;
      trips: number;
      wagonType: string;
      items: Set<string>;
    }
  >();

  for (const t of usable) {
    const { match } = t;
    const trips = t.trips ?? 1;
    const route = routeOf(match);
    const wagonType = WAGON_TYPE_LABEL[match.wagon!.wagonType] ?? match.wagon!.wagonType;

    for (const m of match.members) {
      const item = m.category;
      const key = `${route}|${wagonType}`;
      const row = planMap.get(key) ?? {
        route,
        item: "",
        tons: 0,
        trips: 0,
        wagonType,
        items: new Set<string>(),
      };
      row.items.add(item);
      row.tons += m.weightTon * trips;
      planMap.set(key, row);
    }
  }

  // 편성 단위 수송 횟수를 노선별로 다시 집계
  const tripsByRoute = new Map<string, number>();
  for (const t of usable) {
    const route = routeOf(t.match);
    tripsByRoute.set(route, (tripsByRoute.get(route) ?? 0) + (t.trips ?? 1));
  }
  for (const row of planMap.values()) {
    row.trips = tripsByRoute.get(row.route) ?? 1;
    row.item = [...row.items].join(" · ");
  }

  const planRows = [...planMap.values()]
    .sort((a, b) => b.tons - a.tons)
    .map(({ items: _items, ...r }) => r);
  const totalTons = sum(planRows.map((r) => r.tons));
  const totalTrips = sum([...tripsByRoute.values()]);

  const avgLoadRate =
    sum(usable.map((t) => t.match.loadFactor * t.match.totalTon)) /
    Math.max(1, sum(usable.map((t) => t.match.totalTon)));

  // ── 3. 추가비용 산출
  const railLineHaul = Math.round(sum(usable.map((t) => scale(t, t.match.calc!.cost.breakdown.railLineHaulKrw))));
  const handling = Math.round(sum(usable.map((t) => scale(t, t.match.calc!.cost.breakdown.handlingKrw))));
  const shuttle = Math.round(sum(usable.map((t) => scale(t, t.match.calc!.cost.breakdown.shuttleKrw))));
  const roadOnly = Math.round(sum(usable.map((t) => scale(t, t.match.calc!.cost.roadOnlyKrw))));
  const totalA = railLineHaul + handling + shuttle - roadOnly;

  // ── 4. 사회환경적 편익
  const benefitMap = new Map<string, { label: string; basis: string; source: string; amount: number }>();
  for (const t of usable) {
    for (const item of t.match.calc!.benefit.items) {
      const prev = benefitMap.get(item.key);
      benefitMap.set(item.key, {
        label: item.label,
        basis: item.quantity,
        source: item.source,
        amount: (prev?.amount ?? 0) + scale(t, item.amountKrw),
      });
    }
  }
  const benefitItems = [...benefitMap.entries()].map(([key, v]) => ({
    ...v,
    key,
    amount: Math.round(v.amount),
  }));
  const totalB = sum(benefitItems.map((i) => i.amount));

  const co2Reduced = sum(usable.map((t) => scale(t, t.match.calc!.benefit.co2ReducedTon)));
  const co2Road = sum(usable.map((t) => scale(t, t.match.calc!.benefit.roadCo2Ton)));

  // 편성 1회분 문자열("0.8 tCO₂eq")이 그대로 남으면 12회분 금액과 안 맞는다.
  // 서식에 나란히 인쇄되는 값이므로 집계 후 다시 쓴다.
  const ghg = benefitItems.find((i) => i.key === "ghg");
  if (ghg) ghg.basis = `${round1(co2Reduced)} tCO₂eq`;

  // ── 5. 보조금 산정
  //
  // 상한액 G = (D − F) × 30%. **편익 총액이 아니라 절감액**에 곱한다.
  // D·F 는 협회 공식 원단위로 calc.ts 가 이미 계산해 두었으므로 합산만 한다.
  // benefitItems 의 4개 항목 합계(totalB)를 쓰면 상한이 틀린다 — 표시용 추정치다.
  const socialSaving = sum(
    usable.map((t) => scale(t, t.match.calc!.subsidy.socialSavingKrw)),
  );
  const roadSocial = sum(usable.map((t) => scale(t, t.match.calc!.subsidy.roadSocialKrw)));
  const railSocial = sum(usable.map((t) => scale(t, t.match.calc!.subsidy.railSocialKrw)));

  const eligible = totalA > 0;
  const capB = Math.round(socialSaving * SUBSIDY.benefitCapRate);
  const subsidy = eligible ? Math.min(totalA, capB) : 0;

  return {
    period,
    applicant,
    plan: {
      rows: planRows,
      total: {
        itemCount: new Set([...planMap.values()].flatMap((r) => [...r.items])).size,
        tons: round1(totalTons),
        trips: totalTrips,
        wagonTypeCount: new Set(planRows.map((r) => r.wagonType)).size,
      },
      avgLoadRate,
    },
    extraCost: {
      rows: [
        { label: "철도수송비", formula: `간선 운임 · 복귀 공차 할인 적용`, amount: railLineHaul },
        { label: "상하역비", formula: `${round1(totalTons)}톤 × 양단 상하역`, amount: handling },
        { label: "셔틀운송비", formula: `공장↔역 양단 도로 운송`, amount: shuttle },
        { label: "도로수송비 (차감)", formula: `기존 도로 운송 실적 기준`, amount: -roadOnly },
      ],
      totalA,
    },
    benefit: {
      items: benefitItems,
      totalB,
      official: {
        year: MODAL_SHIFT_YEAR,
        roadUnitCost: MODAL_SHIFT_UNIT_COST_IN_USE.road,
        railUnitCost: MODAL_SHIFT_UNIT_COST_IN_USE.rail,
        roadSocialKrw: Math.round(roadSocial),
        railSocialKrw: Math.round(railSocial),
        savingKrw: Math.round(socialSaving),
      },
      co2ReducedTon: round1(co2Reduced),
      co2ReductionRate: co2Road > 0 ? co2Reduced / co2Road : 0,
      equivalents: {
        pineTrees: Math.round(
          sum(usable.map((t) => scale(t, t.match.calc!.benefit.pineTrees))),
        ),
        trucksBlocked: Math.round(
          sum(usable.map((t) => scale(t, t.match.calc!.benefit.truckLoadsAvoided))),
        ),
      },
    },
    result: {
      A: totalA,
      B: capB,
      adopted: !eligible ? "none" : totalA < capB ? "A" : "B",
      subsidy,
      eligible,
      legalBasis: SUBSIDY.legalBasis,
    },
    coefficientVersion: COEFFICIENT_VERSION,
  };
}

/** 편성 1회분 값을 수송 횟수만큼 확대. 반올림하지 않는다 — 톤수·배출량이 뭉개진다. */
function scale(t: ConfirmedTransport, v: number): number {
  return v * (t.trips ?? 1);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
