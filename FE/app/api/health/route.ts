import { dbDisabledReason, isDbEnabled, tryDb, unwrap } from "@railhub/be/db/client";
import { isLlmConfigured, llmAuthMode, LLM_MODEL } from "@railhub/be/llm";

// ponytail: BE 워크스페이스 배선이 살아 있는지 확인하는 최소 라우트.
//
// ⚠️ 이 라우트는 **일부러 DB 를 한 번 건드린다.** Supabase 무료 플랜은 7일간
//    요청이 0건이면 프로젝트를 재우는데, Vercel 만 깨워 봐야 Supabase 쪽에는
//    아무 요청도 안 간다. keepalive 워크플로가 이 라우트를 치면 그 김에
//    DB 에도 요청이 하나 들어가서 정지 타이머가 리셋된다.
//    (.github/workflows/keepalive.yml)
export const dynamic = "force-dynamic";

export async function GET() {
  const dbConfigured = isDbEnabled();

  // 가장 싼 쿼리 하나 — 살아 있는지만 본다. 실패해도 예외는 안 난다(tryDb 계약).
  const ping = dbConfigured
    ? await tryDb("health", async (db) =>
        unwrap(await db.from("stations").select("id").limit(1)),
      )
    : null;

  return Response.json({
    ok: true,
    llm: {
      provider: "gemini",
      model: LLM_MODEL,
      /** false 면 AI 서술이 전부 사전 작성 초안("데모 모드")으로 나간다 */
      ready: isLlmConfigured(),
      authMode: llmAuthMode(),
    },
    db: {
      configured: dbConfigured,
      /** 실제로 응답했는가. false 면 인메모리 폴백으로 동작 중이다 */
      reachable: ping !== null,
      /** 기준 데이터가 투입돼 있는가 (npm run db:push) */
      seeded: Array.isArray(ping) && ping.length > 0,
      note: dbConfigured ? null : dbDisabledReason(),
    },
  });
}