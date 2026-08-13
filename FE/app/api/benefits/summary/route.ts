import { getBenefitsSummary } from "@railhub/be/benefits";
import { seed } from "@railhub/be/seed";

// 대시보드용 편익 집계 (#28). 분기 누적 편익 + 보조금 상한.
export const dynamic = "force-dynamic";

/** GET /api/benefits/summary?period=2026Q2 */
export function GET(req: Request) {
  const period = new URL(req.url).searchParams.get("period") ?? undefined;
  return Response.json(getBenefitsSummary(period, seed));
}
