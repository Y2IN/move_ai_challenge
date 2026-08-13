import { seed } from "@railhub/be/seed";
import { confirmMatch, validateShipmentInput } from "@railhub/be/store";
import type { ShipmentInput } from "@railhub/be/types";

// 코레일 공차 수송 확정 (#19). 매칭이 matched 일 때만 편성을 확정 기록한다.
export const dynamic = "force-dynamic";

/**
 * POST /api/matching/confirm
 * body: { input?: ShipmentInput, acceptedShipmentIds?: string[] }
 *  - acceptedShipmentIds 를 주면 조율 수락분(예정 물량)을 반영해 재매칭 후 확정
 *    (예: ["SHM-C-002"] — C사 예정 물량 당기기)
 *  - 편성이 성립(matched)하지 않으면 409 로 매칭 결과를 그대로 돌려준다.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  const b = (body && typeof body === "object" ? body : {}) as {
    input?: unknown;
    acceptedShipmentIds?: unknown;
  };

  // 입력이 있으면 검증 후 사용, 없으면 시드 단독
  let input: ShipmentInput | null = null;
  if (b.input != null && typeof b.input === "object" && Object.keys(b.input).length > 0) {
    const v = validateShipmentInput(b.input, seed);
    if (!v.ok || !v.value) {
      return Response.json(
        { error: "입력값이 올바르지 않습니다.", fields: v.errors },
        { status: 400 },
      );
    }
    input = v.value;
  }

  const acceptedShipmentIds = Array.isArray(b.acceptedShipmentIds)
    ? b.acceptedShipmentIds.filter((x): x is string => typeof x === "string")
    : [];

  const result = confirmMatch(input, acceptedShipmentIds, seed);
  if (result.status === "notMatched") {
    return Response.json(
      { error: "편성이 성립하지 않아 확정할 수 없습니다.", match: result.match },
      { status: 409 },
    );
  }
  return Response.json({ confirmation: result.confirmation }, { status: 201 });
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
