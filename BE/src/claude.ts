import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude 클라이언트 초기화 (환경 배선 전용 — 비즈니스 로직 없음).
 *
 * 인증은 두 방식을 모두 받습니다. **둘 중 하나만 있으면 됩니다.**
 *
 *   ANTHROPIC_AUTH_TOKEN  Authorization: Bearer 로 나갑니다.
 *                         Claude 계정 세션(OAuth 액세스 토큰)으로 돌릴 때 씁니다.
 *   ANTHROPIC_API_KEY     x-api-key 로 나갑니다. 콘솔에서 발급한 API 키입니다.
 *
 * 둘 다 있으면 AUTH_TOKEN 이 우선합니다.
 * ANTHROPIC_BASE_URL 로 게이트웨이·프록시를 태울 수 있습니다.
 *
 * 사용 예)
 *   const claude = tryGetClaude();
 *   if (!claude) return fallback();          // 키가 없어도 죽지 않는 경로
 *   const res = await claude.messages.create({
 *     model: CLAUDE_MODEL,
 *     max_tokens: 16000,
 *     messages: [{ role: "user", content: "..." }],
 *   });
 *   const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
 */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

export type ClaudeAuthMode = "authToken" | "apiKey" | "none";

/** 어떤 인증이 잡혀 있는지. 라우트가 env 를 직접 보지 않게 하려고 노출합니다. */
export function claudeAuthMode(): ClaudeAuthMode {
  if (process.env.ANTHROPIC_AUTH_TOKEN) return "authToken";
  if (process.env.ANTHROPIC_API_KEY) return "apiKey";
  return "none";
}

/** 호출 가능한 상태인지. 라우트는 이걸로 폴백 분기를 정합니다. */
export function isClaudeConfigured(): boolean {
  return claudeAuthMode() !== "none";
}

function baseOptions() {
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  return baseURL ? { baseURL } : {};
}

/**
 * 인증이 없으면 `null` 을 돌려줍니다. **throw 하지 않습니다.**
 * 문서 생성은 키가 없어도 폴백으로 끝까지 가야 하므로 이쪽을 쓰세요.
 */
export function tryGetClaude(): Anthropic | null {
  const mode = claudeAuthMode();
  if (mode === "authToken") {
    return new Anthropic({
      authToken: process.env.ANTHROPIC_AUTH_TOKEN,
      ...baseOptions(),
    });
  }
  if (mode === "apiKey") {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...baseOptions() });
  }
  return null;
}

/**
 * 인증이 없으면 throw 합니다. LLM 없이는 의미가 없는 경로에서만 쓰세요.
 * 문서·리포트 생성처럼 폴백이 있는 경로에서는 `tryGetClaude()` 를 쓰십시오.
 */
export function getClaude(): Anthropic {
  const client = tryGetClaude();
  if (!client) {
    throw new Error(
      "Claude 인증이 없습니다. ANTHROPIC_AUTH_TOKEN(계정 세션) 또는 ANTHROPIC_API_KEY 를 .env.local 에 넣으세요.",
    );
  }
  return client;
}
