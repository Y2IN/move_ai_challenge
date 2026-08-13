/**
 * 생성형 AI 배선 (환경 배선 전용 — 비즈니스 로직 없음).
 *
 * 공급자는 **Google Gemini** 입니다 (`@google/genai`).
 *
 * ── 왜 Gemini 인가 ──────────────────────────────────────────────
 *
 * 심사 기간이 2주라 "키가 살아 있어야 하는 기간"이 깁니다. Gemini 는
 * **결제 수단을 등록하지 않으면 무료 티어로 고정**되므로, 크레딧이 바닥나
 * 어느 날 갑자기 폴백으로 떨어지는 사고가 구조적으로 안 납니다.
 * (대신 분당·일일 요청 제한이 있습니다 — 걸리면 폴백으로 떨어집니다)
 *
 * ⚠️ AI Studio 에서 **Set up Billing 을 누르지 마세요.** 누르는 순간 유료
 *    티어로 올라가고 상한이 사라집니다. 무료 티어가 곧 지출 상한입니다.
 *
 * ── 이 모듈의 계약 ─────────────────────────────────────────────
 *
 * `generateText()` 는 **실패하면 throw 합니다.** 호출부가 폴백 문장으로
 * 갈아끼울 수 있도록 일부러 그렇게 뒀습니다 (조용히 빈 문자열을 돌려주면
 * 호출부가 "빈 문단"을 그대로 문서에 실어 버립니다).
 * 인증 여부는 호출 전에 `isLlmConfigured()` 로 확인하세요.
 *
 * 사용 예)
 *   if (!isLlmConfigured()) return fallback();
 *   const text = await generateText({
 *     system: "...", prompt: "...", maxTokens: 1024,
 *   });
 */

import { ApiError, GoogleGenAI } from "@google/genai";

/**
 * 기본 모델.
 *
 * flash 계열만 무료 티어에서 쓸 수 있습니다 (`gemini-2.5-pro` 는 유료 전용).
 * 우리 용도는 짧은 한국어 서술 문단 생성이라 flash 로 충분합니다.
 */
export const LLM_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export type LlmAuthMode = "apiKey" | "none";

/** 어떤 인증이 잡혀 있는지. 라우트가 env 를 직접 보지 않게 하려고 노출합니다. */
export function llmAuthMode(): LlmAuthMode {
  return process.env.GEMINI_API_KEY ? "apiKey" : "none";
}

/** 호출 가능한 상태인지. 라우트·생성기는 이걸로 폴백 분기를 정합니다. */
export function isLlmConfigured(): boolean {
  return llmAuthMode() !== "none";
}

/** 클라이언트는 한 번만 만들어 재사용합니다 (요청마다 새로 만들 이유가 없습니다). */
let cached: GoogleGenAI | null | undefined;

/**
 * 인증이 없으면 `null` 을 돌려줍니다. **throw 하지 않습니다.**
 * 폴백이 있는 경로에서 쓰세요.
 */
export function tryGetLlm(): GoogleGenAI | null {
  if (cached !== undefined) return cached;
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  return (cached = apiKey ? new GoogleGenAI({ apiKey }) : null);
}

/**
 * 실패 원인의 HTTP 상태코드. 네트워크 단절처럼 응답 자체가 없으면 `null`.
 *
 * SDK 의존을 이 파일 안에 가두기 위한 헬퍼입니다 — 호출부가 `@google/genai` 의
 * 에러 타입을 직접 import 하면 공급자를 바꿀 때 또 흩어집니다.
 *
 * ⚠️ **`instanceof ApiError` 로 판정하면 안 됩니다.** SDK 안에 에러 계층이 둘 있는데,
 *    `ApiError` 는 구 `models.*` 경로용이고 우리가 쓰는 `interactions.*` 는
 *    `RateLimitError → APIError → GeminiNextGenAPIClientError` 를 던집니다.
 *    이쪽은 패키지가 export 하지 않아 `instanceof` 자체가 불가능합니다.
 *    실제로 429 를 "연결 실패" 로 잘못 보고하던 원인이었습니다.
 *
 *    두 계층 모두 `status` 를 들고 있으므로 그 필드로 판정합니다.
 */
export function llmErrorStatus(e: unknown): number | null {
  if (e instanceof ApiError) return e.status;
  const err = e as { status?: unknown; statusCode?: unknown } | null;
  const status = err?.status ?? err?.statusCode;
  return typeof status === "number" ? status : null;
}

export interface GenerateOptions {
  /** 역할·문체·금지사항. 매 호출 같은 값이면 캐시에 유리합니다. */
  system: string;
  /** 이번 호출에서만 달라지는 부분 */
  prompt: string;
  /** 출력 상한. 서술 문단은 보통 512~1500 이면 충분합니다. */
  maxTokens: number;
  /**
   * 추론 깊이. 짧은 서술 문단은 깊은 추론이 필요 없어 낮출수록 지연이 줄어듭니다.
   * 다른 공급자의 `effort`/`reasoning` 파라미터에 대응합니다.
   */
  thinking?: "minimal" | "low" | "medium" | "high";
  /** 이 시간을 넘기면 중단하고 throw — 호출부는 폴백으로 갑니다. */
  timeoutMs?: number;
  /**
   * SDK 자체 재시도 횟수. **기본 0이고, 올리지 마세요.**
   *
   * SDK 의 재시도 경로는 이미 소비된 요청 바디를 다시 쓰려다
   * `TypeError: unusable` 로 죽습니다. 그래서 1 이상을 주면 **원래 오류가
   * 그 메시지로 덮여** 버립니다 — 무료 티어에서 제일 흔한 429 조차
   * "연결하지 못함" 으로 잘못 보고됩니다 (실제로 밟은 사고입니다).
   *
   * 재시도가 필요하면 호출부에서 하세요. 그래야 사유를 보고 판단할 수 있습니다
   * (예: `esg/narrative.ts` 는 환각 검출 시 자체 루프로 1회 재생성합니다).
   */
  maxRetries?: number;
}

/**
 * 텍스트 한 덩어리를 생성합니다.
 *
 * 실패(인증 없음·네트워크·한도 초과·빈 응답) 시 **throw** 합니다.
 * 호출부는 try/catch 로 감싸 폴백 문장으로 대체하세요.
 */
export async function generateText(o: GenerateOptions): Promise<string> {
  const ai = tryGetLlm();
  if (!ai) throw new Error("Gemini 인증이 없습니다 (GEMINI_API_KEY)");

  // 서버리스 함수 제한(60s)보다 먼저 끊어야 폴백 문장을 실을 시간이 남습니다.
  const res = await ai.interactions.create(
    {
      model: LLM_MODEL,
      system_instruction: o.system,
      input: o.prompt,
      generation_config: {
        max_output_tokens: o.maxTokens,
        ...(o.thinking ? { thinking_level: o.thinking } : {}),
      },
    },
    {
      ...(o.timeoutMs ? { timeout: o.timeoutMs } : {}),
      maxRetries: o.maxRetries ?? 0,
    },
  );

  const text = (res.output_text ?? "").trim();
  if (!text) throw new Error("빈 응답");
  return text;
}