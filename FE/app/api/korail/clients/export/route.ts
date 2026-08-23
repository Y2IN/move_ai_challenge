import { getClients } from "@railhub/be/clients";
import { buildClientsExport, isSheetFormat } from "@railhub/be/exports";

/** 화주 영업 리스트 내보내기 — 코레일 화주·영업 화면의 "영업 리스트 내보내기" 버튼. */
export const dynamic = "force-dynamic";

/** GET /api/korail/clients/export?format=csv|xlsx|pdf&autoprint=1 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "xlsx";
  if (!isSheetFormat(format)) {
    return Response.json({ error: `format 은 csv | xlsx | pdf 중 하나여야 합니다: ${format}` }, { status: 400 });
  }

  const res = await getClients(new Date());
  const file = await buildClientsExport(res, format, sp.get("autoprint") === "1");
  return new Response(file.body as BodyInit, {
    headers: {
      "content-type": file.contentType,
      "content-disposition": file.inline ? "inline" : `attachment; filename="${file.filename}"`,
      "cache-control": "no-store",
    },
  });
}
