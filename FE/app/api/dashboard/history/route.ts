import { isPersona, PERSONAS } from "@railhub/be/account";
import { getHistory } from "@railhub/be/history";
import { toPositiveInt } from "@railhub/be/http";

/**
 * 분기별 실적 추이 — #7 대시보드의 시계열 짝.
 *
 * #7 은 이번 분기 한 점만 줍니다. 추이 차트·분기별 실적표는 지난 분기가 있어야
 * 그릴 수 있어서, 수송 실적 원장을 분기마다 다시 집계해 돌려줍니다.
 * 각 점은 그 분기를 #40 으로 조회한 값과 같습니다 (같은 집계 함수를 씁니다).
 */
export const dynamic = "force-dynamic";

/** GET /api/dashboard/history?persona=corp|korail&quarters=4 */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const persona = sp.get("persona") ?? "corp";
  if (!isPersona(persona)) {
    return Response.json(
      { error: `persona 는 ${PERSONAS.join(" | ")} 중 하나여야 합니다: ${persona}` },
      { status: 400 },
    );
  }

  const quarters = toPositiveInt(sp.get("quarters")) ?? 4;
  return Response.json(getHistory(persona, quarters, sp.get("baseDate") ?? undefined));
}
