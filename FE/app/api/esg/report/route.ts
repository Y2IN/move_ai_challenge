import { generateReport } from "@railhub/be/esg/narrative";
import { isSectionKey, SECTION_KEYS } from "@railhub/be/esg/paragraphs";
import { EsgQueryError, resolveAggregate } from "@railhub/be/esg/query";
import type { EsgSection, EsgSectionKey } from "@railhub/be/esg/types";

/**
 * #41 POST /api/esg/report
 *
 * 공시 리포트 초안 문구 생성 · "다시 생성". LLM ✅ (서술 문장만).
 *
 * body: {
 *   period?, from?, to?, shipperId?   조회 조건 (#40 과 동일)
 *   sections?: string[]               일부 문단만 재생성 (↻ 버튼). 생략 시 전체
 *   previous?: EsgSection[]           재생성 시 유지할 기존 문단
 * }
 *
 * 문단 생성이 실패해도 200 입니다. 템플릿 문장으로 대체되고 `source: "fallback"`
 * 배지가 붙습니다 — 리포트가 통째로 죽는 것보다 낫습니다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReportBody {
  period?: string;
  from?: string;
  to?: string;
  shipperId?: string;
  sections?: string[];
  previous?: EsgSection[];
}

export async function POST(request: Request) {
  let body: ReportBody;
  try {
    body = (await request.json()) as ReportBody;
  } catch {
    body = {}; // 빈 본문이면 기본 조건(직전 완료 분기 · 전체 화주)으로 생성합니다.
  }

  let sections: EsgSectionKey[] | undefined;
  if (body.sections !== undefined) {
    if (!Array.isArray(body.sections)) {
      return Response.json({ error: "sections 는 문자열 배열이어야 합니다." }, { status: 400 });
    }
    const unknown = body.sections.filter((key) => !isSectionKey(key));
    if (unknown.length > 0) {
      return Response.json(
        { error: `알 수 없는 문단입니다: ${unknown.join(", ")} (가능한 값: ${SECTION_KEYS.join(", ")})` },
        { status: 400 },
      );
    }
    sections = body.sections.filter(isSectionKey);
  }

  try {
    const agg = resolveAggregate({
      period: body.period,
      from: body.from,
      to: body.to,
      shipperId: body.shipperId,
    });

    const report = await generateReport(agg, { sections, previous: body.previous });
    return Response.json(report);
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
