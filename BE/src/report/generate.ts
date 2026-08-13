/**
 * 문단 생성 — 생성 AI 호출 · 병렬 · 환각 검증 · 폴백.
 *
 * 06b 화면이 "약 10초"라고 명시한다. 문단 6개를 순차로 호출하면 서버리스
 * 실행 제한을 넘길 위험이 있어 **전부 병렬로 호출**한다.
 *
 * 각 문단은 다음 순서를 거친다.
 *   1. 생성 AI 호출
 *   2. 숫자 환각 검증 (verify.ts)
 *   3. 환각이 있으면 **한 번만** 재시도 (무엇이 문제였는지 알려주고)
 *   4. 그래도 실패하거나 호출 자체가 실패하면 규칙기반 폴백 문장
 *
 * 폴백이 있어야 현장 네트워크가 끊겨도 문서 생성이 통째로 죽지 않는다.
 */

import { generateText, isLlmConfigured } from "../llm";
import {
  PARAGRAPH_KEYS,
  type Paragraph,
  type ParagraphKey,
  type ReportInput,
} from "./contract";
import { PARAGRAPH_SPECS, SYSTEM_PROMPT, buildPrompt } from "./paragraphs";
import { collectAllowedNumbers, findHallucinatedNumbers } from "./verify";

const MAX_TOKENS = 1024;
/** 환각이 나오면 한 번만 다시 시킨다. 두 번 이상은 시간만 쓴다. */
const MAX_RETRY = 1;

export { isLlmConfigured };

export interface GenerateResult {
  paragraphs: Record<ParagraphKey, Paragraph>;
  /** 진단용 — 어떤 문단이 왜 폴백으로 떨어졌는지 */
  diagnostics: ParagraphDiagnostic[];
}

export interface ParagraphDiagnostic {
  key: ParagraphKey;
  source: Paragraph["source"];
  attempts: number;
  /** 시도별로 검출된 환각 숫자 */
  hallucinations: string[][];
  error?: string;
  elapsedMs: number;
}

function toParagraph(
  key: ParagraphKey,
  text: string,
  source: Paragraph["source"],
): Paragraph {
  return { type: "ai", key, text, source, editable: true, editedByUser: false };
}

/** 문단 하나를 생성한다. 실패해도 절대 throw 하지 않는다 — 폴백으로 떨어진다. */
export async function generateParagraph(
  key: ParagraphKey,
  input: ReportInput,
  startedAt: number = Date.now(),
): Promise<{ paragraph: Paragraph; diagnostic: ParagraphDiagnostic }> {
  const spec = PARAGRAPH_SPECS[key];
  const allowed = collectAllowedNumbers(input);
  const hallucinations: string[][] = [];
  let attempts = 0;
  let lastError: string | undefined;

  const done = (p: Paragraph): { paragraph: Paragraph; diagnostic: ParagraphDiagnostic } => ({
    paragraph: p,
    diagnostic: {
      key,
      source: p.source,
      attempts,
      hallucinations,
      error: lastError,
      elapsedMs: Date.now() - startedAt,
    },
  });

  let prompt = buildPrompt(key, input);

  for (let i = 0; i <= MAX_RETRY; i++) {
    attempts++;
    let text: string;

    try {
      if (!isLlmConfigured()) {
        lastError = "생성 AI 인증 없음";
        break;
      }
      text = await generateText({
        system: SYSTEM_PROMPT,
        prompt,
        maxTokens: MAX_TOKENS,
        // 짧은 서식 문단이라 깊은 추론이 필요 없다. 이걸 빼면 문단 6개 병렬에도
        // 40초까지 늘어나 vercel.json 의 maxDuration(60s) 에 위험하게 붙는다.
        thinking: "low",
        // 문단 하나가 늦어져 전체가 타임아웃되느니, 그 문단만 폴백으로 떨어뜨린다.
        timeoutMs: 25_000,
      });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      break; // 호출 자체가 실패하면 재시도해도 대개 같다 — 바로 폴백
    }

    if (!text) {
      lastError = "빈 응답";
      continue;
    }

    const report = findHallucinatedNumbers(text, allowed);
    if (report.clean) return done(toParagraph(key, text, "ai"));

    hallucinations.push(report.offenders);
    lastError = report.message;

    // 무엇이 문제였는지 알려주고 다시 시킨다
    prompt = [
      buildPrompt(key, input),
      "",
      "[재작성 요청]",
      `직전 응답에 [산출 수치]에 없는 숫자가 있었다: ${report.offenders.join(", ")}`,
      "해당 숫자를 빼고, 주어진 수치만 써서 다시 작성하라. 확신이 없으면 숫자를 아예 쓰지 마라.",
    ].join("\n");
  }

  return done(toParagraph(key, spec.fallback(input), "fallback"));
}

/**
 * 문단 6개를 병렬로 생성한다.
 *
 * `onProgress` 는 문단이 하나 끝날 때마다 호출된다. 06b SSE 진행률에 쓴다.
 * 병렬이라 완료 순서는 문단 순서와 다르다.
 */
export async function generateParagraphs(
  input: ReportInput,
  onProgress?: (done: number, total: number, key: ParagraphKey) => void,
): Promise<GenerateResult> {
  const startedAt = Date.now();
  const total = PARAGRAPH_KEYS.length;
  let completed = 0;

  const settled = await Promise.all(
    PARAGRAPH_KEYS.map(async (key) => {
      const r = await generateParagraph(key, input, startedAt);
      completed++;
      onProgress?.(completed, total, key);
      return r;
    }),
  );

  const paragraphs = {} as Record<ParagraphKey, Paragraph>;
  for (const s of settled) paragraphs[s.paragraph.key] = s.paragraph;

  return { paragraphs, diagnostics: settled.map((s) => s.diagnostic) };
}

/** 전부 폴백으로만 채운다. 인증이 없을 때 화면을 살리는 경로. */
export function generateFallbackOnly(input: ReportInput): GenerateResult {
  const paragraphs = {} as Record<ParagraphKey, Paragraph>;
  const diagnostics: ParagraphDiagnostic[] = [];

  for (const key of PARAGRAPH_KEYS) {
    paragraphs[key] = toParagraph(key, PARAGRAPH_SPECS[key].fallback(input), "fallback");
    diagnostics.push({
      key,
      source: "fallback",
      attempts: 0,
      hallucinations: [],
      error: "생성 AI 인증 없음 — 폴백 문장 사용",
      elapsedMs: 0,
    });
  }
  return { paragraphs, diagnostics };
}
