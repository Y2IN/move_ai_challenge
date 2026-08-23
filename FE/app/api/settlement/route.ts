import { getSettlement, UnknownContractError } from "@railhub/be/settlement";

/**
 * 전환교통 협약 정산.
 *
 * 협약(약속)과 원장(실적)을 맞대어 이행률을 내고, 보조금을 실적 기준으로 다시
 * 계산합니다. 재산정은 `computeSubsidy` 를 원장 건별로 부르므로 신청서(#31)·
 * 편익(#27)과 같은 산식입니다 — 세 화면의 금액이 갈라질 수 없습니다.
 */
export const dynamic = "force-dynamic";

/** GET /api/settlement?now=YYYY-MM-DD&contractNo=KLARU-2026-0412 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("now");
  const now = raw ? new Date(raw) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }
  try {
    return Response.json(await getSettlement(now, undefined, sp.get("contractNo")));
  } catch (e) {
    if (e instanceof UnknownContractError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
