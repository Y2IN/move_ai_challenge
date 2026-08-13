import { toPositiveInt } from "@railhub/be/http";
import { listMatches } from "@railhub/be/dashboard";
import { seed } from "@railhub/be/seed";

// 합적 매칭 현황 목록 (#8). 상세는 #9(/api/matches/{id})로 lazy 로딩.
export const dynamic = "force-dynamic";

/** GET /api/matches?persona=&status=done|group|wait&page=&pageSize= */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") ?? undefined;
  const page = toPositiveInt(sp.get("page"));
  const pageSize = toPositiveInt(sp.get("pageSize"));
  return Response.json(listMatches({ status, page, pageSize }, seed));
}
