/**
 * 편익 집계 — #28 GET /api/benefits/summary (대시보드용 기간 집계).
 *
 * 분기 누적 편익은 대시보드 큐레이션 데이터(seed.dashboard)를 재사용하고,
 * 보조금 상한 비율·법적 근거는 constants 에서 가져온다.
 * (#27 benefits/calculate 의 단건 계산 엔진은 calc.ts 에 이미 있음 — 라우트만 미구현)
 */

import { SOURCES, SUBSIDY } from "./constants";
import { seed } from "./seed";
import type { BenefitItem, DashboardEquivalents, SeedData } from "./types";

export interface BenefitsSummary {
  period: string;
  totalBenefitKrw: number;
  breakdown: BenefitItem[];
  /** 전환교통 보조금 상한 = 편익 × 비율 (고시 근거) */
  subsidyCap: { rate: number; amountKrw: number; legalBasis: string };
  equivalents: DashboardEquivalents;
  cumulative: { shippers: number; filledWagons: number };
}

export function getBenefitsSummary(
  period: string | undefined,
  data: SeedData = seed,
): BenefitsSummary {
  const d = data.dashboard;
  return {
    period: period || d.period,
    totalBenefitKrw: d.benefit.totalBenefitKrw,
    breakdown: d.benefit.breakdown,
    subsidyCap: {
      rate: SUBSIDY.benefitCapRate,
      amountKrw: d.subsidyEstimate.amount,
      legalBasis: SOURCES.subsidy,
    },
    equivalents: d.equivalents,
    cumulative: d.cumulative,
  };
}
