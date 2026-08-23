import { isPersona } from "@railhub/be/account";
import { buildPerformanceExport, isSheetFormat } from "@railhub/be/exports";
import { getHistory } from "@railhub/be/history";
import { toPositiveInt } from "@railhub/be/http";

/**
 * 수송 실적 리포트 — "수송 실적 리포트 발행" · "직전 분기 실적" 버튼.
 *
 * `quarters` 로 최근 N개 분기를, `period` 로 특정 분기 한 개를 뽑습니다.
 */
export const dynamic = "force-dynamic";

/** GET /api/korail/performance/report?format=pdf&persona=korail&quarters=4&period=2026Q1 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "pdf";
  if (!isSheetFormat(format)) {
    return Response.json({ error: `format 은 csv | xlsx | pdf 중 하나여야 합니다: ${format}` }, { status: 400 });
  }

  const persona = sp.get("persona") ?? "korail";
  if (!isPersona(persona)) {
    return Response.json({ error: `알 수 없는 persona 입니다: ${persona}` }, { status: 400 });
  }

  const history = await getHistory(persona, toPositiveInt(sp.get("quarters")) ?? 4);

  // 특정 분기만 요청하면 그 한 점만 남깁니다 (없으면 400 — 빈 리포트를 주면
  // 사용자는 "실적이 0" 이라고 읽습니다).
  const period = sp.get("period");
  const items = period ? history.items.filter((p) => p.period === period) : history.items;
  if (period && !items.length) {
    return Response.json({ error: `해당 분기 실적이 없습니다: ${period}` }, { status: 400 });
  }

  const file = await buildPerformanceExport({ ...history, items }, format, sp.get("autoprint") === "1");
  return new Response(file.body as BodyInit, {
    headers: {
      "content-type": file.contentType,
      "content-disposition": file.inline ? "inline" : `attachment; filename="${file.filename}"`,
      "cache-control": "no-store",
    },
  });
}
