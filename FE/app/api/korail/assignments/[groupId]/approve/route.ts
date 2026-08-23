import { badJson, readBody } from "@railhub/be/http";
import { approveConfirmation } from "@railhub/be/store";

/**
 * api_list #43 — 화차 배정 승인 (코레일 담당자).
 *
 * 화주 쪽 "확정"과 코레일 쪽 "승인"은 다른 사건이다. 확정은 화주가 이 편성으로
 * 가겠다는 의사이고, 승인은 코레일이 그 화차를 실제로 내주겠다는 배차 결정이다.
 * 그래서 확정 API 를 다시 부르지 않고 상태만 올린다.
 *
 * 이미 승인된 편성은 200 으로 그대로 돌려준다 (연타해도 같은 결과 — 멱등).
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ groupId: string }> };

/** POST /api/korail/assignments/{groupId}/approve  body?: { approvedBy } */
export async function POST(req: Request, ctx: Ctx) {
  const { groupId } = await ctx.params;
  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const body = (parsed.kind === "json" ? parsed.value : {}) as { approvedBy?: unknown };
  const approvedBy = typeof body.approvedBy === "string" && body.approvedBy.trim()
    ? body.approvedBy.trim()
    : undefined;

  const result = await approveConfirmation(groupId, approvedBy);
  if (result.status === "notFound") {
    return Response.json({ error: `편성을 찾을 수 없습니다: ${groupId}` }, { status: 404 });
  }

  return Response.json({
    confirmation: result.confirmation,
    alreadyApproved: result.status === "alreadyApproved",
  });
}
