import { badJson, readBody } from "@railhub/be/http";
import { listParseCases, parseFreight, parseStatus } from "@railhub/be/parse";

// 자연어 → 구조화 폼 (#10) — 생성 AI 우선, 규칙(케이스) 폴백.
// GET  : 고를 수 있는 데모 케이스 목록
// POST : { text?, caseId? } → 파싱 결과. `source` 로 ai/rule 을 구분한다.
//        caseId 가 오면 화면이 케이스를 고른 것이므로 AI 를 부르지 않는다.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/freights/parse — 예시 문장 목록 + AI 가 붙어 있는지.
 *
 * `demo` 는 **LLM 설정 여부**다. 예전엔 `true` 로 박혀 있어서 AI 가 실제로 돌아도
 * 화면에 "LLM 파싱 미구현" 배지가 떴다.
 */
export function GET() {
  return Response.json({ ...parseStatus(), cases: listParseCases() });
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
    await parseFreight({
      text: typeof body.text === "string" ? body.text : undefined,
      caseId: typeof body.caseId === "string" ? body.caseId : undefined,
    }),
  );
}
