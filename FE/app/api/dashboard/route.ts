import { getDashboard } from "@railhub/be/dashboard";
import { seed } from "@railhub/be/seed";
import type { Persona } from "@railhub/be/types";

// 홈 대시보드 (#7). persona별 KPI(큐레이션) + 라이브 편익 breakdown.
export const dynamic = "force-dynamic";

const PERSONAS: Persona[] = ["corp", "korail"];

/** GET /api/dashboard?persona=corp|korail&period= */
export function GET(req: Request) {
  const persona = new URL(req.url).searchParams.get("persona") ?? "corp";
  if (!PERSONAS.includes(persona as Persona)) {
    return Response.json(
      { error: `persona 는 ${PERSONAS.join(" | ")} 중 하나여야 합니다: ${persona}` },
      { status: 400 },
    );
  }
  return Response.json(getDashboard(persona as Persona, seed));
}
