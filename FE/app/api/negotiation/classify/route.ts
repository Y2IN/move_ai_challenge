import { classifyConstraintText, DEMO_NOTICE, listClassifyExamples } from "@railhub/be/classify";
import { badJson, readBody } from "@railhub/be/http";

// 화주 자연어 제약 → 절대조건/조정가능 분류 (#21) — 생성 AI 우선, 규칙 폴백.
// GET  : 예시 발화 목록(시드 화물의 constraintText)
// POST : { utterance? | shipmentId? } → 분류 결과. `source` 로 ai/rule 을 구분한다.
//
// 근거(evidence)가 원문에 없는 제약은 서버가 걸러내고 `warnings` 에 사유를 남긴다.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    await classifyConstraintText({
      utterance: typeof body.utterance === "string" ? body.utterance : undefined,
      shipmentId: typeof body.shipmentId === "string" ? body.shipmentId : undefined,
      shipper: typeof body.shipper === "string" ? body.shipper : undefined,
    }),
  );
}
