import { seed } from "@railhub/be/seed";
import { listVacancies } from "@railhub/be/wagons";

// 코레일 공차 현황 (#18). 시드 공차를 역명/노선까지 풀어서 반환한다.
export const dynamic = "force-dynamic";

/** GET /api/wagons/vacancies[?laneId=] — 공차(빈 화차) 목록 */
export function GET(req: Request) {
  const laneId = new URL(req.url).searchParams.get("laneId") ?? undefined;
  const items = listVacancies(seed, laneId);
  return Response.json({ items, count: items.length });
}
