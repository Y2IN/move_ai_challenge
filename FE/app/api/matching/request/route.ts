import { badJson, isEmptyObject, readBody, validationError } from "@railhub/be/http";
import { match } from "@railhub/be/matching";
import { seed } from "@railhub/be/seed";
import { validateShipmentInput } from "@railhub/be/store";

// AI 합적 매칭 요청 (#16). 매칭 엔진(match)은 이미 BE 에 있으므로 라우트는 얇게:
// 입력 검증 → match() → MatchResult 그대로 반환.
export const dynamic = "force-dynamic";

/**
 * POST /api/matching/request
 * - 본문이 없거나 빈 객체({})면 시드 단독으로 매칭 → 시연 실패 시나리오(14/18톤).
 * - 본문에 화물 입력이 있으면 검증 후 그 화물을 포함해 재매칭.
 * - 본문이 깨진 JSON 이면 400 (빈 본문과 구분).
 * 응답: MatchResult (status matched/shortfall/noWagon, members, wagon, calc, negotiationCandidates ...)
 */
export async function POST(req: Request) {
  const body = await readBody(req);
  if (body.kind === "invalid") return badJson();
  const raw = body.kind === "json" ? body.value : {};

  // 빈 본문/빈 객체 = "지금 접수된 화물 풀 그대로 매칭" (시드 단독).
  if (isEmptyObject(raw)) {
    return Response.json(match(seed, null));
  }

  const { ok, errors, value } = validateShipmentInput(raw, seed);
  if (!ok || !value) return validationError(errors);

  return Response.json(match(seed, value));
}
