/**
 * 홈 대시보드 (STEP 03) — #7 대시보드 · #8 매칭 현황 목록.
 *
 * ## 숫자는 어디서 오는가
 *
 * 예전에는 `seed.dashboard` 의 상수를 그대로 내보냈다. 그 값은 큐레이션이 아니라
 * **수송 실적 원장 2026Q2 집계의 사본**이었고, 원장을 다시 생성할 때마다 여기만
 * 낡아 랜딩(실집계)과 홈(시드 상수)이 같은 분기·같은 지표에서 갈라졌다.
 *
 * 이제 원장에서 그 자리에서 집계한다 (랜딩 #6 과 같은 경로).
 * 시드에 남는 건 원장으로 계산할 수 없는 값뿐이다:
 *   - `cumulative` 플랫폼 누적 화주 수 (한 분기 원장으로 못 구한다)
 *   - `matches` 시연용 편성 예시 (실제 확정 편성이 있으면 그게 앞에 붙는다)
 *   - KPI 중 운송비 절감·전환율·공차율·추가 수익 (원장 밖 운영 지표)
 */

import { loadLedger } from "./db/ledger";

import { loadUniverse } from "./db/universe";
// DB 전용 findLatestConfirmation 이 아니라 store 의 진입점을 쓴다 —
// 폴백 모드(환경변수 없음·DB 잠듦)에서 확정 편성이 목록에서 통째로 사라져
// 코레일 배차 승인(#43) 버튼이 영영 안 뜨던 원인이다. report/source.ts 와 같은 경로다.
import { latestConfirmation } from "./store";
import { aggregateWith } from "./esg/query";
import type { EsgAggregate } from "./esg/types";
import type {
  BenefitItem,
  DashboardResponse,
  KpiCard,
  MatchRow,
  MatchSummary,
  Persona,
  SeedData,
} from "./types";

/** 342004280 → "3억 4,200만" (랜딩 포맷과 같은 규칙) */
function krwShort(n: number): string {
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString("en-US")}만`);
  return parts.join(" ") || n.toLocaleString("ko-KR");
}

function previousQuarterId(periodId: string): string | null {
  const m = /^(\d{4})Q([1-4])$/.exec(periodId);
  if (!m) return null;
  const year = Number(m[1]);
  const q = Number(m[2]);
  return q === 1 ? `${year - 1}Q4` : `${year}Q${q - 1}`;
}

/** 전 분기 대비 증감률. 비교 대상이 없으면 **지어내지 않고 생략한다.** */
function deltaOf(current: number, previous: number | undefined): number | undefined {
  if (previous === undefined || previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * 큐레이션 KPI(운송비 절감·전환율 등)의 값은 시드에서 가져오되,
 * 원장으로 계산 가능한 항목은 라이브 값으로 덮어쓴다.
 */
function liveKpis(
  persona: Persona,
  seedKpis: KpiCard[],
  agg: EsgAggregate,
  prev: EsgAggregate | null,
): KpiCard[] {
  const benefitDelta = deltaOf(agg.totalBenefitKrw, prev?.totalBenefitKrw);
  const co2Delta = deltaOf(agg.reducedCo2Ton, prev?.reducedCo2Ton);
  const tripDelta = deltaOf(agg.tripCount, prev?.tripCount);

  return seedKpis.map((kpi): KpiCard => {
    switch (kpi.key) {
      case "co2Reduction":
        return { ...kpi, value: `${agg.reducedCo2Ton.toFixed(1)} tCO₂eq`, deltaPct: co2Delta };
      case "benefit":
        return {
          ...kpi,
          value: krwShort(agg.totalBenefitKrw),
          amountKrw: agg.totalBenefitKrw,
          deltaPct: benefitDelta,
        };
      case "filledWagons":
        return {
          ...kpi,
          value: `${agg.tripCount.toLocaleString("ko-KR")}량`,
          count: agg.tripCount,
          deltaPct: tripDelta,
        };
      default:
        // 원장 밖 운영 지표 (공차율·전환율·추가 수익·신규 화주) — 시드 값 유지
        return kpi;
    }
  });
}

/** #7 홈 대시보드 — 원장 라이브 집계 + persona별 운영 KPI */
export async function getDashboard(
  persona: Persona,
  seedData?: SeedData,
): Promise<DashboardResponse> {
  const [loaded, ledger] = await Promise.all([loadUniverse(), loadLedger()]);
  const data = seedData ?? loaded;
  const d = data.dashboard;
  // 방어: 시드에 없는 persona 로 호출돼도 500 대신 corp 로 폴백한다.
  const personaData = d.personas[persona] ?? d.personas.corp;

  const agg = aggregateWith({}, ledger, data);
  const prevId = previousQuarterId(agg.period.id);
  let prev: EsgAggregate | null = null;
  if (prevId) {
    try {
      prev = aggregateWith({ period: prevId }, ledger, data);
    } catch {
      // 원장에 그 분기가 없으면 증감 비교를 생략한다 (랜딩과 같은 규칙)
    }
  }

  const breakdown: BenefitItem[] = agg.benefitItems.map((item) => {
    // 시드의 표시용 물리량 표기(quantity)를 살려 둔다 — 집계에는 없는 값이다.
    const seedItem = d.benefit.breakdown.find((b) => b.key === item.key);
    return {
      key: item.key as BenefitItem["key"],
      label: item.label,
      quantity: seedItem?.quantity ?? "",
      amountKrw: item.amountKrw,
      source: item.source,
    };
  });

  return {
    persona,
    period: agg.period.id,
    kpis: liveKpis(persona, personaData.kpis, agg, prev),
    subsidyEstimate: {
      ...d.subsidyEstimate,
      // 고시상 상한 B = 편익의 30%
      amount: Math.round(agg.totalBenefitKrw * 0.3),
      label: krwShort(Math.round(agg.totalBenefitKrw * 0.3)),
      deltaPct: deltaOf(agg.totalBenefitKrw, prev?.totalBenefitKrw) ?? d.subsidyEstimate.deltaPct,
    },
    equivalents: { pineTrees: agg.pineTrees, trucksBlocked: agg.truckLoadsAvoided },
    breakdown,
    totalBenefitKrw: agg.totalBenefitKrw,
  };
}

export interface MatchesResult {
  items: MatchSummary[];
  count: number;
  page: number;
  pageSize: number;
  total: number;
}

/** 실제로 확정된 편성을 목록 행으로. 없으면 null. */
async function confirmedRow(
  data: SeedData,
): Promise<(MatchRow & { approval: MatchSummary["approval"] }) | null> {
  const c = await latestConfirmation();
  if (!c) return null;

  const partners = c.members.map((m) => m.shipperName);
  const lane = data.lanes.find((l) => l.id === c.wagon.laneId);
  const stationName = (id: string | undefined) =>
    data.stations.find((s) => s.id === id)?.name ?? id ?? "";
  // 도로 직행 대비 절감 — 목록의 "N% 절감" 배지가 이 값이다
  const roadOnly = c.calc?.cost.roadOnlyKrw ?? 0;
  const saving = Math.max(0, roadOnly - (c.calc?.cost.railPooledKrw ?? roadOnly));

  return {
    id: c.groupId,
    route: lane ? `${stationName(lane.originStationId)} → ${stationName(lane.destStationId)}` : "",
    wagon: c.wagon.label,
    sub: `${partners.slice(0, 2).join("·")}${partners.length > 2 ? ` 외 ${partners.length - 2}사` : ""}`,
    tons: Math.round(c.totalTon * 10) / 10,
    loadRate: Math.round(c.loadFactor * 100) / 100,
    status: "group",
    savingPct: roadOnly > 0 ? Math.round((saving / roadOnly) * 100) : 0,
    savingKrw: Math.round(saving),
    approval: { status: c.status, approvedAt: c.approvedAt ?? null },
    detail: {
      partners,
      departAt: `${c.wagon.departure.date}T${c.wagon.departure.time}:00+09:00`,
      co2ReducedTon: Math.round((c.calc?.benefit.co2ReducedTon ?? 0) * 10) / 10,
      equivalentKrw: Math.round(c.calc?.benefit.totalBenefitKrw ?? 0),
    },
  };
}

/**
 * #8 매칭 현황 목록 — status 필터 + 페이지네이션.
 * 실제 확정 편성이 있으면 시연용 예시 앞에 붙는다.
 */
export async function listMatches(
  opts: { status?: string; page?: number; pageSize?: number } = {},
  seedData?: SeedData,
): Promise<MatchesResult> {
  const data = seedData ?? (await loadUniverse());
  const pageSize = Math.max(1, opts.pageSize ?? 10);
  const page = Math.max(1, opts.page ?? 1);

  const live = await confirmedRow(data);
  let rows = live ? [live, ...data.dashboard.matches] : data.dashboard.matches;
  if (opts.status) rows = rows.filter((r) => r.status === opts.status);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize).map(toSummary);
  return { items, count: items.length, page, pageSize, total };
}

/** #9 매칭 상세 — id 로 한 건 조회 (상세 detail 포함). 없으면 null. */
export async function getMatch(id: string, seedData?: SeedData): Promise<MatchRow | null> {
  const data = seedData ?? (await loadUniverse());
  const live = await confirmedRow(data);
  if (live && live.id === id) return live;
  return data.dashboard.matches.find((m) => m.id === id) ?? null;
}

/** 목록 행에서 상세(detail)를 떼되, 출발 예정 시각은 남긴다 (04b "출발 예정" 열). */
function toSummary(row: MatchRow & { approval?: MatchSummary["approval"] }): MatchSummary {
  const { detail, ...summary } = row;
  return { ...summary, departAt: detail.departAt };
}
