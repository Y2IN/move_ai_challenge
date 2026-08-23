import { getConfirmation } from "@railhub/be/store";

/**
 * 확정 편성 조회 — 편성 번호(GRP-NNN) 한 건.
 *
 * 확정 화면(04e)이 **쓰기 없이** 그려지도록 만든 진입점이다. 예전에는 화면이
 * 마운트될 때마다 확정 API(쓰기)를 불러서, 새로고침·뒤로가기·StrictMode 이중
 * 실행마다 편성이 새로 발급됐다.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ groupId: string }> };

/** GET /api/matching/confirmations/{groupId} */
export async function GET(_req: Request, ctx: Ctx) {
  const { groupId } = await ctx.params;
  const confirmation = await getConfirmation(groupId);
  if (!confirmation) {
    return Response.json({ error: `편성을 찾을 수 없습니다: ${groupId}` }, { status: 404 });
  }
  return Response.json({ confirmation });
}
