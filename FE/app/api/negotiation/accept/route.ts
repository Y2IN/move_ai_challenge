import { accept } from "@railhub/be/negotiate";
import { seed } from "@railhub/be/seed";
import type { ShipmentInput } from "@railhub/be/types";

/**
 * api_list #24 — 조율안 수락 → 재매칭.
 *
 * 수락된 예정 물량을 편성에 끌어와 매칭·편익·보조금을 전부 다시 계산한다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { shipment?: ShipmentInput; acceptedShipmentIds?: string[]; now?: string }
    | null;

  const ids = body?.acceptedShipmentIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json(
      { error: "acceptedShipmentIds 가 비어 있습니다" },
      { status: 400 },
    );
  }

  const now = body?.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const { result, calc } = accept(seed, body?.shipment ?? null, ids, now);
  return Response.json({ ...result, calc });
}
