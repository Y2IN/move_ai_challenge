import { getCoefficients } from "@railhub/be/coefficients";

// 배출계수·사회적비용 단가·산식 파라미터 (#29). constants.ts 노출.
export const dynamic = "force-dynamic";

/** GET /api/coefficients?year=2026 */
export function GET() {
  return Response.json(getCoefficients());
}
