import { badJson, readBody } from "@railhub/be/http";
import { DEMO_NOTICE, listParseCases, parseFreightText } from "@railhub/be/parse";

// 자연어 → 구조화 폼 (#10) — 데모 버전(LLM 미연결).
// GET  : 고를 수 있는 데모 케이스 목록
// POST : { text?, caseId? } → 파싱 결과 (notice에 데모 안내 포함)
export const dynamic = "force-dynamic";

/** GET /api/freights/parse — 데모 케이스 목록 */
export function GET() {
  return Response.json({ demo: true, notice: DEMO_NOTICE, cases: listParseCases() });
}

/** POST /api/freights/parse — { text?, caseId? } */
export async function POST(req: Request) {
  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const body = (
    parsed.kind === "json" && parsed.value && typeof parsed.value === "object"
      ? parsed.value
      : {}
  ) as { text?: unknown; caseId?: unknown };

  return Response.json(
    parseFreightText({
      text: typeof body.text === "string" ? body.text : undefined,
      caseId: typeof body.caseId === "string" ? body.caseId : undefined,
    }),
  );
}
