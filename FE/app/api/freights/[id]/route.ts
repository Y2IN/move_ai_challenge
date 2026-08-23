import { badJson, readBody, validationError } from "@railhub/be/http";
import { loadUniverse } from "@railhub/be/db/universe";
import { deleteShipment, NOT_PERSISTED_NOTE, updateShipment } from "@railhub/be/store";

// 화물 수정(#14) · 삭제(#15). Next 15 에서 동적 세그먼트 params 는 Promise 이므로 await 한다.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/freights/{id} — 부분 수정 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const body = await readBody(req);
  if (body.kind === "invalid") return badJson();
  const patch = body.kind === "json" ? body.value : {};

  const result = await updateShipment(id, patch, await loadUniverse());
  if (result.status === "notFound") {
    return Response.json({ error: `화물을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  if (result.status === "invalid") {
    return validationError(result.errors);
  }
  // 저장소 기록 실패를 성공으로 응답하지 않는다 (다음 조회는 DB 를 먼저 본다)
  return Response.json({
    shipment: result.shipment,
    persisted: result.persisted,
    ...(result.persisted ? {} : { note: NOT_PERSISTED_NOTE }),
  });
}

/** DELETE /api/freights/{id} — 삭제 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { deleted, persisted } = await deleteShipment(id);
  if (!deleted) {
    return Response.json({ error: `화물을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  return Response.json({
    deleted: id,
    persisted,
    ...(persisted ? {} : { note: NOT_PERSISTED_NOTE }),
  });
}
