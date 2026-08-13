import { match } from "@railhub/be/matching";
import { seed } from "@railhub/be/seed";
import type { ShipmentInput } from "@railhub/be/types";

/**
 * api_list #16 — AI 합적 매칭 요청 (04a "AI 합적 매칭 요청" 버튼).
 *
 * 시드 화물 풀 + 사용자가 방금 등록한 화물을 합쳐 편성을 만든다.
 * 정원 미달이면 `status: "shortfall"` 로 돌려주고 조율 에이전트(#22)로 넘긴다.
 *
 * `now` 를 받는 이유: 마감시한 기준 상태(phase)가 시각에 따라 달라지므로
 * 시연에서 특정 시점을 고정할 수 있어야 한다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { shipment?: ShipmentInput; now?: string }
    | null;

  const now = body?.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const result = match(seed, body?.shipment ?? null, now);
  return Response.json(result);
}
