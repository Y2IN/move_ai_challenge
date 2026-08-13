import { badJson, readBody, validationError } from "@railhub/be/http";
import { match } from "@railhub/be/matching";
import { seed } from "@railhub/be/seed";
import { listShipments, registerShipment, validateShipmentInput } from "@railhub/be/store";

// 화물 등록 · 목록 (디자인 04a). 등록할 때마다 합적 매칭이 다시 돌아가므로,
// POST 응답에 편성 미리보기(matchPreview)를 함께 실어 04a → 04b 전환을 매끄럽게 한다.
export const dynamic = "force-dynamic";

/** GET /api/freights — 등록된 화물 목록 (사이드바 "화물") */
export function GET() {
  const items = listShipments();
  return Response.json({ items, count: items.length });
}

/** POST /api/freights — 화물 등록 */
export async function POST(req: Request) {
  const body = await readBody(req);
  if (body.kind === "invalid") return badJson();
  const raw = body.kind === "json" ? body.value : {};

  const { ok, errors, value } = validateShipmentInput(raw, seed);
  if (!ok || !value) return validationError(errors);

  const shipment = registerShipment(value, seed);

  // 편성 전체가 아니라 요약만 — 상세 편성/조율은 별도 매칭 API(#16)의 몫이다.
  const m = match(seed, value);
  const matchPreview = {
    status: m.status,
    wagonLabel: m.wagon?.label ?? null,
    totalTon: m.totalTon,
    capacityTon: m.capacityTon,
    loadFactor: m.loadFactor,
    shortfallTon: m.shortfallTon,
    message: m.message,
  };

  return Response.json({ shipment, matchPreview }, { status: 201 });
}
