import { getClients } from "@railhub/be/clients";

/**
 * 코레일 화주 · 영업 — 화주별 협약 이행 현황.
 *
 * 협약 물량은 시드(약속), 실적은 수송 실적 원장(실제)에서 옵니다. 이행률·상태·
 * 재계약 D-day 는 전부 서버가 계산합니다 — 화면이 계산하면 같은 규칙이 두 군데
 * 생기고, 한쪽만 고치는 순간 갈라집니다.
 */
export const dynamic = "force-dynamic";

/** GET /api/korail/clients?now=YYYY-MM-DD */
export function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("now");
  const now = raw ? new Date(raw) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }
  return Response.json(getClients(now));
}
