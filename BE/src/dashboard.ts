/**
 * 홈 대시보드 (STEP 03) — #7 대시보드 · #8 매칭 현황 목록.
 *
 * 이 모듈은 **데이터 조립만** 한다. 편익 계산 로직은 계산 모듈(#27, 별도 담당)이 소유하고,
 * 대시보드는 그 결과를 받아 화면 형태로 넘겨줄 뿐이다.
 * 지금은 계산 모듈이 준비 전이라 시드의 큐레이션 `benefit` 값을 그대로 쓴다.
 */

import { seed } from "./seed";
import type { DashboardResponse, MatchRow, Persona, SeedData } from "./types";

/** #7 홈 대시보드 — persona별 KPI(큐레이션) + 편익 내역 */
export function getDashboard(persona: Persona, data: SeedData = seed): DashboardResponse {
  const d = data.dashboard;

  // ── 편익 내역 seam ──────────────────────────────────────────
  // 편익 계산 모듈(#27)이 준비되면 아래 두 값을 그 함수 호출로 교체한다.
  //   예) const { breakdown, totalBenefitKrw } = benefitSummary(data, d.period);
  const breakdown = d.benefit.breakdown;
  const totalBenefitKrw = d.benefit.totalBenefitKrw;

  return {
    persona,
    period: d.period,
    kpis: d.personas[persona].kpis,
    subsidyEstimate: d.subsidyEstimate,
    equivalents: d.equivalents,
    breakdown,
    totalBenefitKrw,
  };
}

export interface MatchesResult {
  items: MatchRow[];
  count: number;
  page: number;
  pageSize: number;
  total: number;
}

/** #8 매칭 현황 목록 — status 필터 + 페이지네이션. 상세(detail)는 각 행에 인라인. */
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
  const items = rows.slice(start, start + pageSize);
  return { items, count: items.length, page, pageSize, total };
}
