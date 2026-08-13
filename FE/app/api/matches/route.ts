import { listMatches } from "@railhub/be/dashboard";
import { seed } from "@railhub/be/seed";

// 합적 매칭 현황 목록 (#8). 상세는 각 행 detail 에 인라인(#9 미구현).
export const dynamic = "force-dynamic";

/** GET /api/matches?persona=&status=done|group|wait&page= */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") ?? undefined;
  const pageRaw = Number(sp.get("page"));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return Response.json(listMatches({ status, page }, seed));
}
