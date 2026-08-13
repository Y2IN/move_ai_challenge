import { match } from "@railhub/be/matching";
import { seed } from "@railhub/be/seed";
import { validateShipmentInput } from "@railhub/be/store";

// AI 합적 매칭 요청 (#16). 매칭 엔진(match)은 이미 BE 에 있으므로 라우트는 얇게:
// 입력 검증 → match() → MatchResult 그대로 반환.
export const dynamic = "force-dynamic";

/**
 * POST /api/matching/request
 * - 본문이 비어 있으면(본문 없음/`null`/`{}`) 시드 단독으로 매칭 → 시연 실패 시나리오(14/18톤).
 * - 본문에 화물 입력이 있으면 검증 후 그 화물을 포함해 재매칭.
 * 응답: MatchResult (status matched/shortfall/noWagon, members, wagon, calc, negotiationCandidates ...)
 */
export async function POST(req: Request) {
  const body = await readJson(req);

  // 빈 본문 = "지금 접수된 화물 풀 그대로 매칭" (시드 단독). 이 프로젝트의 기본 실패 시나리오.
  if (isEmpty(body)) {
    return Response.json(match(seed, null));
  }

  const { ok, errors, value } = validateShipmentInput(body, seed);
  if (!ok || !value) {
    return Response.json(
      { error: "입력값이 올바르지 않습니다.", fields: errors },
      { status: 400 },
    );
  }

  return Response.json(match(seed, value));
}

/** 본문을 JSON 으로 읽되, 없거나 파싱 실패면 null (→ 시드 단독 매칭으로 취급) */
async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isEmpty(body: unknown): boolean {
  return (
    body == null ||
    (typeof body === "object" && Object.keys(body as object).length === 0)
  );
}
