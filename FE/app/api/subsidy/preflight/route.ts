import { EsgQueryError } from "@railhub/be/esg/query";
import { getPreflight } from "@railhub/be/preflight";

/**
 * api_list #30 — 신청서 생성 전 사전 점검.
 *
 * 06a 의 체크리스트가 화면 상수(고정 문구)였다. 실제로 데이터가 없어도 항상
 * "준비 완료"로 떠서 점검이 점검을 안 했다. 판정 근거(집계·계수·산식)는 전부
 * 서버에 있으므로 서버가 판정해 문구까지 준다.
 */
export const dynamic = "force-dynamic";

/** GET /api/subsidy/preflight?period=2026Q2 */
export async function GET(req: Request) {
  const period = new URL(req.url).searchParams.get("period");
  try {
    return Response.json(await getPreflight({ period }));
  } catch (error) {
    if (error instanceof EsgQueryError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
