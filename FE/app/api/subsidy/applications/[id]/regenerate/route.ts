import { PARAGRAPH_KEYS } from "@railhub/be/report/contract";
import {
  generateFallbackOnly,
  generateParagraphs,
  isLlmConfigured,
} from "@railhub/be/report/generate";
import { find, replaceParagraph, saveDiagnostics } from "@railhub/be/report/store";

/**
 * api_list #35 — 전체 재생성 (06c "전체 재생성" 버튼).
 *
 * 사용자가 직접 고친 문단(`editedByUser`)은 **기본적으로 보존한다.**
 * 손으로 쓴 문장을 말없이 날리면 안 된다. `?force=true` 로 덮어쓸 수 있다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const app = await find(id);
  if (!app) {
    return Response.json({ error: `초안을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }

  const force = new URL(req.url).searchParams.get("force") === "true";
  const input = app.input;

  const { paragraphs, diagnostics } = isLlmConfigured()
    ? await generateParagraphs(input)
    : generateFallbackOnly(input);

  const now = new Date().toISOString();
  const kept: string[] = [];

  // ⚠️ DB 모드에서 `find()` 는 호출할 때마다 행을 새로 매핑한 **별개 객체**를 준다.
  //    replaceParagraph 도 내부에서 다시 find 하므로, 맨 위에서 잡아 둔 `app` 은
  //    교체 결과를 전혀 보지 못한다. 그대로 응답에 실으면 LLM 을 6번 부르고
  //    DB 에 새 문단을 저장했는데도 **화면 글자가 하나도 안 바뀐다** (버튼 먹통).
  //    그래서 반환값을 이어받아 최신 스냅샷으로 응답한다.
  let latest = app;

  for (const key of PARAGRAPH_KEYS) {
    if (!force && latest.document.paragraphs[key]?.editedByUser) {
      kept.push(key);
      continue;
    }
    latest = (await replaceParagraph(id, key, paragraphs[key], "regenerate", now)) ?? latest;
  }

  await saveDiagnostics(id, diagnostics);

  return Response.json({
    applicationId: id,
    document: latest.document,
    diagnostics,
    keptUserEdits: kept,
    revisionCount: latest.revisions.length,
  });
}
