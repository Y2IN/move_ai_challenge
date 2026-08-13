import { badJson, isEmptyObject, readBody, validationError } from "@railhub/be/http";
import { match } from "@railhub/be/matching";
import { seed } from "@railhub/be/seed";
import { validateShipmentInput } from "@railhub/be/store";
import type { ShipmentInput } from "@railhub/be/types";

/**
 * api_list #16 — AI 합적 매칭 요청 (04a "AI 합적 매칭 요청" 버튼).
 *
 * 시드 화물 풀 + 사용자가 방금 등록한 화물을 합쳐 편성을 만든다.
 * 정원 미달이면 `status: "shortfall"` 로 돌려주고 조율 에이전트(#22)로 넘긴다.
 *
 * body: { shipment?: ShipmentInput, now?: string }
 *  - shipment 가 있으면 검증 후 포함, 없으면 시드 단독(시연 실패 시나리오).
 *  - now 는 마감시한 기준 상태(phase)를 시연에서 고정하기 위한 시각.
 *  - 본문이 깨진 JSON 이면 400 (빈 본문과 구분).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const body = (
    parsed.kind === "json" && parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)
      ? parsed.value
      : {}
  ) as { shipment?: unknown; now?: string };

  const now = body.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }

  // 화물 입력이 있으면 검증, 없으면 시드 단독
  let shipment: ShipmentInput | null = null;
  if (!isEmptyObject(body.shipment)) {
    const v = validateShipmentInput(body.shipment, seed);
    if (!v.ok || !v.value) return validationError(v.errors);
    shipment = v.value;
  }

  return Response.json(match(seed, shipment, now));
}
