import { clearEdit, listEdits, saveEdit } from "@railhub/be/db/esg-edits";
import { isSectionKey, SECTION_KEYS } from "@railhub/be/esg/paragraphs";
import { EsgQueryError, resolveAggregateDb } from "@railhub/be/esg/query";
import { NOT_PERSISTED_NOTE } from "@railhub/be/store";
import { badJson, readBody } from "@railhub/be/http";

/**
 * K-ESG 리포트 문단 직접 편집 (#41 의 짝).
 *
 * 사업계획서 문단(#37)은 초안 문서에 바로 저장하지만, ESG 리포트는 **매번 실적에서
 * 다시 생성**하므로 결과를 통째로 저장할 수 없다 (원장이 바뀌면 숫자도 바뀌어야 한다).
 * 그래서 사람이 고친 문단만 (기간·화주·문단) 키로 남기고, 생성할 때 덮어씌운다.
 *
 * DELETE 는 편집을 지워 다음 생성부터 AI 문장이 다시 나오게 한다.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

/** 어느 기간·화주의 리포트를 고치는지 — 생성 때와 같은 규칙으로 해석한다. */
async function scope(url: URL) {
  const agg = await resolveAggregateDb({
    period: url.searchParams.get("period"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    shipperId: url.searchParams.get("shipperId"),
  });
  return { periodId: agg.period.id, shipperId: agg.shipperId ?? null };
}

/** PATCH /api/esg/report/sections/{key}?period=&shipperId=  body: { text } */
export async function PATCH(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  if (!isSectionKey(key)) {
    return Response.json(
      { error: `알 수 없는 문단입니다: ${key} (가능한 값: ${SECTION_KEYS.join(", ")})` },
      { status: 400 },
    );
  }

  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const text = ((parsed.kind === "json" ? parsed.value : {}) as { text?: unknown }).text;
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return Response.json({ error: "text 가 비어 있습니다" }, { status: 400 });
  }

  try {
    const { periodId, shipperId } = await scope(new URL(req.url));
    const editedAt = new Date().toISOString();
    const { persisted } = await saveEdit({ periodId, shipperId, key, text: trimmed, editedAt });

    return Response.json({
      section: {
        key,
        text: trimmed,
        source: "user",
        warnings: ["직접 편집한 문단입니다. 서버가 숫자를 보증하지 않습니다."],
      },
      periodId,
      shipperId,
      editedAt,
      persisted,
      ...(persisted ? {} : { note: NOT_PERSISTED_NOTE }),
    });
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/** DELETE — 편집을 지우고 AI 문장으로 되돌린다 */
export async function DELETE(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  if (!isSectionKey(key)) {
    return Response.json({ error: `알 수 없는 문단입니다: ${key}` }, { status: 400 });
  }
  try {
    const { periodId, shipperId } = await scope(new URL(req.url));
    await clearEdit(periodId, shipperId, key);
    const left = await listEdits(periodId, shipperId);
    return Response.json({ cleared: key, remaining: [...left.keys()] });
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
