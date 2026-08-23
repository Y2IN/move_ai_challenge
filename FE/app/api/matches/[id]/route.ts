import { getMatch } from "@railhub/be/dashboard";

// 매칭 상세 (#9). 목록(#8)에는 요약만 싣고, 상세는 여기서 lazy 로딩한다.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/matches/{id} — 매칭 한 건 상세 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const match = await getMatch(id);
  if (!match) {
    return Response.json({ error: `매칭을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  return Response.json(match);
}
