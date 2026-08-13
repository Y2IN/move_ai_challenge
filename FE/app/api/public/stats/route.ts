import { getPublicStats } from "@railhub/be/public";
import { seed } from "@railhub/be/seed";

// 랜딩 히어로 수치 (#6). 로그인 전 공개. 요청별로 다르지 않으므로 60초 캐시.
export const revalidate = 60;

/** GET /api/public/stats */
export function GET() {
  return Response.json(getPublicStats(seed), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
