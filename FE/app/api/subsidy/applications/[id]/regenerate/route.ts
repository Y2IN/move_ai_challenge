import { PARAGRAPH_KEYS } from "@railhub/be/report/contract";
import {
  generateFallbackOnly,
  generateParagraphs,
  isLlmConfigured,
} from "@railhub/be/report/generate";
import { find, replaceParagraph } from "@railhub/be/report/store";

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

  for (const key of PARAGRAPH_KEYS) {
    if (!force && app.document.paragraphs[key]?.editedByUser) {
      kept.push(key);
      continue;
    }
    await replaceParagraph(id, key, paragraphs[key], "regenerate", now);
  }

  app.diagnostics = diagnostics;

  return Response.json({
    applicationId: id,
    document: app.document,
    diagnostics,
    keptUserEdits: kept,
    revisionCount: app.revisions.length,
  });
}
