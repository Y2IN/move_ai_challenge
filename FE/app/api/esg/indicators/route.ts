import { buildIndicators } from "@railhub/be/esg/indicators";
import { EsgQueryError, resolveAggregate } from "@railhub/be/esg/query";
import type { EsgIndicatorsResponse } from "@/src/lib/esg";

/**
 * #40 GET /api/esg/indicators?period=&shipperId=
 *
 * K-ESG 지표표 (E-3-2 · E-7-1 · E-3-3). LLM 미사용 — 전부 계산값입니다.
 *
 *   period    2026Q2 · 2026-05 · 2026 (생략 시 직전 완료 분기)
 *   from,to   YYYY-MM-DD 임의 구간 (period 보다 우선)
 *   shipperId 특정 화주만 집계 (생략 시 전체)
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  try {
    const agg = resolveAggregate({
      period: params.get("period"),
      from: params.get("from"),
      to: params.get("to"),
      shipperId: params.get("shipperId"),
    });

    // 응답 모양은 FE/src/lib/esg.ts 의 EsgIndicatorsResponse 가 소유합니다.
    const payload: EsgIndicatorsResponse = {
      period: agg.period,
      shipperId: agg.shipperId,
      shipperName: agg.shipperName,
      indicators: buildIndicators(agg),
      summary: {
        tripCount: agg.tripCount,
        legCount: agg.legCount,
        shipperCount: agg.shipperCount,
        totalTon: agg.totalTon,
        avgLoadRate: agg.avgLoadRate,
        // 편익 대시보드(05)의 도로 vs 철도 비교 막대에 필요합니다. 새 계산이 아니라
        // 집계에 이미 있는 값의 노출입니다.
        baselineCo2Ton: agg.baselineCo2Ton,
        actualCo2Ton: agg.actualCo2Ton,
        reducedCo2Ton: agg.reducedCo2Ton,
        reductionRate: agg.reductionRate,
        totalBenefitKrw: agg.totalBenefitKrw,
        benefitItems: agg.benefitItems,
        pineTrees: agg.pineTrees,
        truckLoadsAvoided: agg.truckLoadsAvoided,
      },
      coefficientVersion: agg.coefficientVersion,
      verified: agg.verified,
    };
    return Response.json(payload);
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
