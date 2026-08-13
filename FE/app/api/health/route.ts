import { CLAUDE_MODEL } from "@railhub/be/claude";

// ponytail: BE 워크스페이스 배선이 살아 있는지 확인하는 최소 라우트.
// 실제 의존성(외부 API·DB) 헬스체크가 필요해지면 여기에 붙인다.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    model: CLAUDE_MODEL,
    apiKeyLoaded: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
