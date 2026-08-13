import {
  EsgSectionInputError,
  generateReport,
  parsePreviousSections,
} from "@railhub/be/esg/narrative";
import { isSectionKey, SECTION_KEYS } from "@railhub/be/esg/paragraphs";
import { EsgQueryError, resolveAggregate } from "@railhub/be/esg/query";
import type { EsgSectionKey } from "@railhub/be/esg/types";

/**
 * #41 POST /api/esg/report
 *
 * 공시 리포트 초안 문구 생성 · "다시 생성". LLM ✅ (서술 문장만).
 *
 * body: {
 *   period?, from?, to?, shipperId?   조회 조건 (#40 과 동일)
 *   sections?: string[]               일부 문단만 재생성 (↻ 버튼). 생략 시 전체
 *   previous?: EsgSection[]           재생성 시 유지할 기존 문단
 *   draftSeed?: number                폴백 초안 회전 인덱스 — 재생성마다 화면이 1씩 올려 보냅니다
 * }
 *
 * 문단 생성이 실패해도 200 입니다. 사전 작성된 서술 초안으로 대체되고
 * `source: "fallback"` 배지가 붙습니다 — 리포트가 통째로 죽는 것보다 낫습니다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 본문은 신뢰할 수 없는 입력입니다. 타입 단언이 아니라 검증으로 좁힙니다. */
interface ReportBody {
  period?: string;
  from?: string;
  to?: string;
  shipperId?: string;
  sections?: unknown;
  previous?: unknown;
  draftSeed?: unknown;
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
    const unknown = body.sections.filter((key) => typeof key !== "string" || !isSectionKey(key));
    if (unknown.length > 0) {
      return Response.json(
        { error: `알 수 없는 문단입니다: ${unknown.join(", ")} (가능한 값: ${SECTION_KEYS.join(", ")})` },
        { status: 400 },
      );
    }
    sections = body.sections.filter((k): k is EsgSectionKey => typeof k === "string" && isSectionKey(k));
  }

  // 회전 인덱스입니다. 값 자체는 `fallbackText` 가 초안 개수로 나머지 연산해 감싸므로
  // 범위 제한이 필요 없지만, 숫자가 아닌 값이 오면 `Math.trunc` 가 NaN 을 만들어
  // 조용히 1번 초안으로 굳어버립니다. 모양만 여기서 막습니다.
  if (body.draftSeed !== undefined && !Number.isFinite(body.draftSeed)) {
    return Response.json({ error: "draftSeed 는 숫자여야 합니다." }, { status: 400 });
  }

  // previous 도 sections 와 같은 수준으로 검증합니다. 여기를 비워두면
  // 배열이 아닌 값이 generateReport 안에서 TypeError 를 내 400 이어야 할 요청이 500 이 됩니다.
  let previous;
  try {
    previous = parsePreviousSections(body.previous);
  } catch (error) {
    if (error instanceof EsgSectionInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    const agg = resolveAggregate({
      period: body.period,
      from: body.from,
      to: body.to,
      shipperId: body.shipperId,
    });

    const report = await generateReport(agg, {
      sections,
      previous,
      draftSeed: body.draftSeed as number | undefined,
    });
    return Response.json(report);
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
