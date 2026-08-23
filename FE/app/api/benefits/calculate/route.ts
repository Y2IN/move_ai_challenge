import { badJson, isEmptyObject, readBody, validationError } from "@railhub/be/http";
import { match } from "@railhub/be/matching";
import { accept } from "@railhub/be/negotiate";
import { buildMatchData, validateShipmentInput } from "@railhub/be/store";
import type { ShipmentInput } from "@railhub/be/types";

// 도로 단독 vs 철도 합적 → 4대 편익 (#27). calc 엔진(calc.ts)을 라우트로 노출.
// 편성이 성립(matched)할 때만 calc 가 채워진다 (미달이면 calc=null).
export const dynamic = "force-dynamic";

/**
 * POST /api/benefits/calculate
 * body: { shipment?, acceptedShipmentIds?, now? }
 *  - shipment 를 넣으면 그 화물을 포함해 편성, acceptedShipmentIds 로 조율 수락분 반영.
 *  - 응답: { status, totalTon, capacityTon, loadFactor, calc }
 */
export async function POST(req: Request) {
  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const raw = (
    parsed.kind === "json" && parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
      ? parsed.value
      : {}
  ) as { shipment?: unknown; acceptedShipmentIds?: unknown; now?: string; registeredId?: string };

  const now = raw.now ? new Date(raw.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const data = await buildMatchData(raw.registeredId ?? null);

  let shipment: ShipmentInput | null = null;
  if (!isEmptyObject(raw.shipment)) {
    const v = validateShipmentInput(raw.shipment, data);
    if (!v.ok || !v.value) return validationError(v.errors);
    shipment = v.value;
  }

  const ids = Array.isArray(raw.acceptedShipmentIds)
    ? raw.acceptedShipmentIds.filter((x): x is string => typeof x === "string")
    : [];

  const result = ids.length ? accept(data, shipment, ids, now).result : match(data, shipment, now);

  return Response.json({
    status: result.status,
    totalTon: result.totalTon,
    capacityTon: result.capacityTon,
    loadFactor: result.loadFactor,
    calc: result.calc,
  });
}
