import { getNegotiation } from "@railhub/be/store";

// 조율 최종 편성 결과 조회 (#25). run(#22)이 발급한 NEG-NNN id 로 조회.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/negotiation/{id} */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const record = await getNegotiation(id);
  if (!record) {
    return Response.json({ error: `조율 세션을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  return Response.json(record);
}
