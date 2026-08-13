import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude 클라이언트 초기화 (환경 배선 전용 — 비즈니스 로직 없음).
 *
 * 사용 예)
 *   const claude = getClaude();
 *   const res = await claude.messages.create({
 *     model: CLAUDE_MODEL,
 *     max_tokens: 16000,
 *     thinking: { type: "adaptive" },   // 복잡한 작업이면 켜두는 쪽이 낫다
 *     messages: [{ role: "user", content: "..." }],
 *   });
 *   // res.content 는 블록 배열이므로 type 으로 좁혀서 꺼낼 것
 *   const text = res.content.find((b) => b.type === "text")?.text ?? "";
 */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

export function getClaude(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.");
  }
  return new Anthropic({ apiKey });
}
