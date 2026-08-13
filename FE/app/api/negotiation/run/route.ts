import { negotiate } from "@railhub/be/negotiate";
import { seed } from "@railhub/be/seed";
import { saveNegotiation } from "@railhub/be/store";
import type { ShipmentInput } from "@railhub/be/types";

/**
 * api_list #22 — 조율 에이전트 실행.
 *
 * **양보 대가가 절감액보다 큰 화주는 서버가 먼저 걸러낸다.** LLM은 통과한 건에
 * 대해서만 설득 문장을 쓴다. 걸러진 건은 `rejected` 에 사유와 함께 담겨 나가므로
 * 화면에서 "왜 이 화주에게는 제안하지 않았는지"를 그대로 보여줄 수 있다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { shipment?: ShipmentInput; now?: string }
    | null;

  const now = body?.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }

  // 결과를 세션으로 저장하고 id 를 함께 반환 — #25 조회·#26 취소가 이 id 를 쓴다.
  const result = await negotiate(seed, body?.shipment ?? null, now);
  const { id } = saveNegotiation(result);
  return Response.json({ id, ...result });
}
