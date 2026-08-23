/**
 * 홈 대시보드 (STEP 03) — #7 대시보드 · #8 매칭 현황 목록.
 *
 * 이 모듈은 **데이터 조립만** 한다. 편익 계산 로직은 계산 모듈(#27, 별도 담당)이 소유하고,
 * 대시보드는 그 결과를 받아 화면 형태로 넘겨줄 뿐이다.
 * 지금은 계산 모듈이 준비 전이라 시드의 `benefit` 값을 그대로 쓴다.
 *
 * ⚠️ 그 시드 값은 큐레이션 상수가 아니라 **수송 실적 원장 2026Q2 집계의 사본**이다.
 *    랜딩(#6)·ESG 리포트(#40)·정산은 원장을 그 자리에서 집계하므로, 원장을 다시
 *    생성하면 여기만 낡아 같은 분기·같은 지표가 화면마다 갈라진다.
 *    `npx tsx scripts/gen-ledger.ts` 가 끝에 반영할 값을 찍어 준다.
 */

import { seed } from "./seed";
import type {
  DashboardResponse,
  MatchRow,
  MatchSummary,
  Persona,
  SeedData,
} from "./types";

/** #7 홈 대시보드 — persona별 KPI(큐레이션) + 편익 내역 */
export function getDashboard(persona: Persona, data: SeedData = seed): DashboardResponse {
  const d = data.dashboard;
  // 방어: 시드에 없는 persona 로 호출돼도 500 대신 corp 로 폴백한다.
  const personaData = d.personas[persona] ?? d.personas.corp;

  // ── 편익 내역 seam ──────────────────────────────────────────
  // 편익 계산 모듈(#27)이 준비되면 아래 두 값을 그 함수 호출로 교체한다.
  //   예) const { breakdown, totalBenefitKrw } = benefitSummary(data, d.period);
  const breakdown = d.benefit.breakdown;
  const totalBenefitKrw = d.benefit.totalBenefitKrw;

  return {
    persona,
    period: d.period,
    kpis: personaData.kpis,
    subsidyEstimate: d.subsidyEstimate,
    equivalents: d.equivalents,
    breakdown,
    totalBenefitKrw,
  };
}

export interface MatchesResult {
  items: MatchSummary[];
  count: number;
  page: number;
  pageSize: number;
  total: number;
}

/**
 * #8 매칭 현황 목록 — status 필터 + 페이지네이션.
 * 목록이 커질 수 있으므로 상세(detail)는 빼고 요약만 반환한다 (상세는 #9).
 */
export function listMatches(
  opts: { status?: string; page?: number; pageSize?: number } = {},
  data: SeedData = seed,
): MatchesResult {
  const pageSize = Math.max(1, opts.pageSize ?? 10);
  const page = Math.max(1, opts.page ?? 1);

  let rows = data.dashboard.matches;
  if (opts.status) rows = rows.filter((r) => r.status === opts.status);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize).map(toSummary);
  return { items, count: items.length, page, pageSize, total };
}

/** #9 매칭 상세 — id 로 한 건 조회 (상세 detail 포함). 없으면 null. */
export function getMatch(id: string, data: SeedData = seed): MatchRow | null {
  return data.dashboard.matches.find((m) => m.id === id) ?? null;
}

/** 목록 행에서 상세(detail)를 떼어 요약만 남긴다. */
function toSummary({ detail: _detail, ...summary }: MatchRow): MatchSummary {
  return summary;
}
