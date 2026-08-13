import { GoogleGenAI } from "@google/genai";

/**
 * Gemini 클라이언트 초기화 (환경 배선 전용 — 비즈니스 로직 없음).
 *
 * 사용 예)
 *   const ai = getGemini();
 *   const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents: "..." });
 *   res.text
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.");
  }
  return new GoogleGenAI({ apiKey });
}
