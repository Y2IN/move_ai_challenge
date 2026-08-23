import { badJson, isEmptyObject, readBody, validationError } from "@railhub/be/http";
import { loadUniverse } from "@railhub/be/db/universe";
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
  const body = await readBody(req);
  if (body.kind === "invalid") return badJson();
  const raw =
    body.kind === "json" && body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as {
          input?: unknown;
          acceptedShipmentIds?: unknown;
          registeredId?: string;
          clientKey?: string;
        })
      : {};

  const universe = await loadUniverse();

  // 입력이 있으면 검증 후 사용, 없으면 시드 단독
  let input: ShipmentInput | null = null;
  if (!isEmptyObject(raw.input)) {
    const v = validateShipmentInput(raw.input, universe);
    if (!v.ok || !v.value) return validationError(v.errors);
    input = v.value;
  }

  const acceptedShipmentIds = Array.isArray(raw.acceptedShipmentIds)
    ? raw.acceptedShipmentIds.filter((x): x is string => typeof x === "string")
    : [];

  const result = await confirmMatch(input, acceptedShipmentIds, {
    registeredId: raw.registeredId ?? null,
    // 같은 키로 다시 들어온 확정은 새 편성을 만들지 않고 기존 것을 돌려준다
    clientKey: raw.clientKey ?? null,
  });
  if (result.status === "notMatched") {
    return Response.json(
      { error: "편성이 성립하지 않아 확정할 수 없습니다.", match: result.match },
      { status: 409 },
    );
  }
  return Response.json({ confirmation: result.confirmation }, { status: 201 });
}
