import { badJson, readBody, validationError } from "@railhub/be/http";
import { seed } from "@railhub/be/seed";
import { deleteShipment, updateShipment } from "@railhub/be/store";

// 화물 수정(#14) · 삭제(#15). Next 15 에서 동적 세그먼트 params 는 Promise 이므로 await 한다.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/freights/{id} — 부분 수정 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const body = await readBody(req);
  if (body.kind === "invalid") return badJson();
  const patch = body.kind === "json" ? body.value : {};

  const result = updateShipment(id, patch, seed);
  if (result.status === "notFound") {
    return Response.json({ error: `화물을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  if (result.status === "invalid") {
    return validationError(result.errors);
  }
  return Response.json({ shipment: result.shipment });
}

/** DELETE /api/freights/{id} — 삭제 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!deleteShipment(id)) {
    return Response.json({ error: `화물을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  return Response.json({ deleted: id });
}
