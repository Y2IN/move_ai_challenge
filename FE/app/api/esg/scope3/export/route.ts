import { EsgQueryError, resolveAggregate } from "@railhub/be/esg/query";
import { buildExport, EXPORT_FORMATS, isExportFormat } from "@railhub/be/esg/scope3";

/**
 * #42 GET /api/esg/scope3/export?format=csv|xlsx|pdf&period=&shipperId=
 *
 * Scope 3 원자료 내보내기. LLM 미사용.
 * 검증기관이 재계산할 수 있도록 건별 명세 + 적용 계수표를 함께 내보냅니다.
 *
 *   csv   기계 판독용 원자료 (명세 1장, UTF-8 BOM)
 *   xlsx  실무용 통합문서 (요약 · 명세 · 계수 3시트)
 *   pdf   공시 부속서 — **인쇄용 HTML** 로 응답합니다.
 *         브라우저가 열어서 인쇄(→ PDF로 저장)하는 방식이라 파일로 내려받지 않습니다.
 *         `&autoprint=1` 을 붙이면 열리자마자 인쇄 대화상자를 띄웁니다.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const format = params.get("format") ?? "csv";

  if (!isExportFormat(format)) {
    return Response.json(
      { error: `format 은 ${EXPORT_FORMATS.join(" · ")} 중 하나여야 합니다: ${format}` },
      { status: 400 },
    );
  }

  try {
    const agg = resolveAggregate({
      period: params.get("period"),
      from: params.get("from"),
      to: params.get("to"),
      shipperId: params.get("shipperId"),
    });

    const file = await buildExport(agg, format, {
      autoPrint: params.get("autoprint") === "1",
    });

    return new Response(file.body as BodyInit, {
      headers: {
        "content-type": file.contentType,
        // 인쇄용 HTML 은 attachment 로 주면 브라우저가 다운로드해버려 인쇄를 못 합니다.
        // 파일명이 ASCII 라 filename* 인코딩은 생략합니다.
        "content-disposition": file.inline
          ? "inline"
          : `attachment; filename="${file.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
