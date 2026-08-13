import { PARAGRAPH_KEYS, type ParagraphKey } from "@railhub/be/report/contract";
import { generateParagraph, isLlmConfigured } from "@railhub/be/report/generate";
import { PARAGRAPH_SPECS } from "@railhub/be/report/paragraphs";
import { find, replaceParagraph } from "@railhub/be/report/store";
import { verifyParagraph } from "@railhub/be/report/verify";

/**
 * api_list #36 — 문단 단위 재생성 (06c 의 ↻ 버튼)
 * api_list #37 — 문단 편집 저장 ("AI 서술 · 편집 가능")
 *
 * 편집 저장에도 **환각 검증을 돌린다.** 사람이 고친 문장이라도 서식에 나가는
 * 숫자는 근거가 있어야 한다. 다만 사람 편집은 막지 않고 경고만 실어 보낸다.
 */
export const dynamic = "force-dynamic";
// 최악 경로는 25초 타임아웃 × 2회(환각 재시도)라 30초로는 모자란다.
export const maxDuration = 60;

function parseKey(raw: string): ParagraphKey | null {
  return (PARAGRAPH_KEYS as string[]).includes(raw) ? (raw as ParagraphKey) : null;
}

/** #36 재생성 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key: rawKey } = await params;
  const key = parseKey(rawKey);
  if (!key) {
    return Response.json(
      { error: `알 수 없는 문단: ${rawKey}`, allowed: PARAGRAPH_KEYS },
      { status: 400 },
    );
  }
  const existing = await find(id);
  if (!existing) {
    return Response.json({ error: `초안을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }

  // 초안을 만들 때 쓴 입력을 그대로 재사용한다. 다시 resolve 하면 그 사이 편성이
  // 바뀌어 문단이 문서의 표와 다른 수치를 인용하게 된다.
  const input = existing.input;
  const { paragraph, diagnostic } = isLlmConfigured()
    ? await generateParagraph(key, input)
    : {
        paragraph: {
          type: "ai" as const,
          key,
          text: PARAGRAPH_SPECS[key].fallback(input),
          source: "fallback" as const,
          editable: true,
          editedByUser: false,
        },
        diagnostic: {
          key,
          source: "fallback" as const,
          attempts: 0,
          hallucinations: [],
          error: "생성 AI 인증 없음",
          elapsedMs: 0,
        },
      };

  const updated = await replaceParagraph(id, key, paragraph, "regenerate", new Date().toISOString());
  return Response.json({
    applicationId: id,
    paragraph,
    diagnostic,
    revisionCount: updated?.revisions.length ?? 0,
  });
}

/** #37 편집 저장 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key: rawKey } = await params;
  const key = parseKey(rawKey);
  if (!key) {
    return Response.json({ error: `알 수 없는 문단: ${rawKey}` }, { status: 400 });
  }
  const stored = await find(id);
  if (!stored) {
    return Response.json({ error: `초안을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return Response.json({ error: "text 가 비어 있습니다" }, { status: 400 });
  }

  // 사람이 고친 문장도 검사한다. 막지는 않고 경고만 붙인다.
  const check = verifyParagraph(text, stored.input);

  const app = await replaceParagraph(
    id,
    key,
    { type: "ai", key, text, source: "user", editable: true, editedByUser: true },
    "edit",
    new Date().toISOString(),
  );

  return Response.json({
    applicationId: id,
    paragraph: app?.document.paragraphs[key],
    warning: check.clean ? null : check.message,
    revisionCount: app?.revisions.length ?? 0,
  });
}
