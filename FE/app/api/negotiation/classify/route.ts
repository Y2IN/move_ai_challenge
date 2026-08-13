import { classify, DEMO_NOTICE, listClassifyExamples } from "@railhub/be/classify";
import { badJson, readBody } from "@railhub/be/http";

// 화주 자연어 제약 → 절대조건/조정가능 분류 (#21) — 데모 버전(LLM 미연결).
// GET  : 예시 발화 목록(시드 화물의 constraintText)
// POST : { utterance? | shipmentId? } → 분류 결과 (notice에 데모 안내)
export const dynamic = "force-dynamic";

/** GET /api/negotiation/classify — 예시 발화 목록 */
export function GET() {
  return Response.json({ demo: true, notice: DEMO_NOTICE, examples: listClassifyExamples() });
}

/** POST /api/negotiation/classify — { utterance?, shipmentId?, shipper? } */
export async function POST(req: Request) {
  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const body = (
    parsed.kind === "json" && parsed.value && typeof parsed.value === "object"
      ? parsed.value
      : {}
  ) as { utterance?: unknown; shipmentId?: unknown; shipper?: unknown };

  return Response.json(
    classify({
      utterance: typeof body.utterance === "string" ? body.utterance : undefined,
      shipmentId: typeof body.shipmentId === "string" ? body.shipmentId : undefined,
      shipper: typeof body.shipper === "string" ? body.shipper : undefined,
    }),
  );
}
