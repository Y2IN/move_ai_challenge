import { buildSettlementExport, isSheetFormat } from "@railhub/be/exports";
import { getSettlement, UnknownContractError } from "@railhub/be/settlement";

/**
 * 정산 보고서 내보내기 — 정산 화면의 "정산 보고서 생성" 버튼.
 *
 * 새 산식을 쓰지 않습니다. 화면이 보고 있는 `getSettlement` 응답을 그대로
 * 표로 옮깁니다 — 그래야 화면과 파일의 숫자가 갈라지지 않습니다.
 */
export const dynamic = "force-dynamic";

/** GET /api/settlement/report?format=pdf|csv|xlsx&contractNo=&autoprint=1 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "pdf";
  if (!isSheetFormat(format)) {
    return Response.json({ error: `format 은 csv | xlsx | pdf 중 하나여야 합니다: ${format}` }, { status: 400 });
  }

  try {
    const res = await getSettlement(new Date(), undefined, sp.get("contractNo"));
    const file = await buildSettlementExport(res, format, sp.get("autoprint") === "1");
    return new Response(file.body as BodyInit, {
      headers: {
        "content-type": file.contentType,
        "content-disposition": file.inline ? "inline" : `attachment; filename="${file.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof UnknownContractError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
