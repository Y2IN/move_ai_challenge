/**
 * 문단 생성 — 통합 호출 1회 · 문단별 환각 검증 · 폴백.
 *
 * 흐름:
 *   1. 문단 6개를 **한 번의 호출로** 받는다 (JSON 스키마 응답)
 *   2. 출력 검사 (guard.ts) — **문단별로** 돈다
 *        · 숫자: 입력에 없는 숫자가 있는가 (verify.ts)
 *        · 표현: 검증받은 척·홍보 수식어·서식 누출이 있는가
 *   3. 검사에 걸린 문단만 모아 **한 번 더** 부른다 (두 사유를 한 번에 알려준다)
 *   4. 그래도 남거나 호출 자체가 실패하면 그 문단만 규칙기반 폴백 문장
 *
 * ⚠️ 왜 통합인가: 무료 티어는 분당 **요청 수**로 한도를 잰다(모델당 20 RPM).
 *    문단마다 따로 부르면 사업계획서 1회 생성이 6요청이라 분당 3회면 한도다.
 *    통합하면 같은 한도에서 20회까지 생성할 수 있다.
 *
 * ⚠️ 다만 **[산출 수치]는 문단별로 분리해서** 프롬프트에 넣는다. 6개 문단의 수치를
 *    한 덩어리로 합치면 허용 집합이 그만큼 넓어져, 개요 문단이 보조금 산정액을
 *    인용해도 검증을 통과해 버린다 (buildCombinedPrompt 참고).
 *
 * 폴백이 있어야 현장 네트워크가 끊겨도, 한도에 걸려도 문서 생성이 통째로 죽지 않는다.
 */

import { generateText, isLlmConfigured } from "../llm";
import {
  PARAGRAPH_KEYS,
  type Paragraph,
  type ParagraphKey,
  type ReportInput,
} from "./contract";
import {
  PARAGRAPH_SPECS,
  SYSTEM_PROMPT,
  buildCombinedPrompt,
  buildPrompt,
  combinedSchema,
} from "./paragraphs";
import { inspectOutput } from "./guard";
import { collectAllowedNumbers } from "./verify";

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
  /** 시도별로 검출된 표현 규칙 위반 (guard.ts). 예전 레코드에는 없어 optional */
  violations?: string[][];
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
  const violations: string[][] = [];
  let attempts = 0;
  let lastError: string | undefined;

  const done = (p: Paragraph): { paragraph: Paragraph; diagnostic: ParagraphDiagnostic } => ({
    paragraph: p,
    diagnostic: {
      key,
      source: p.source,
      attempts,
      hallucinations,
      violations,
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

    const report = inspectOutput(text, allowed);
    if (report.clean) return done(toParagraph(key, text, "ai"));

    if (report.offenders.length) hallucinations.push(report.offenders);
    if (report.violations.length) violations.push(report.violations.map((v) => v.matched));
    lastError = report.message;

    // 무엇이 문제였는지 알려주고 다시 시킨다. 숫자·표현을 **한 번에** 넘긴다 —
    // 사유마다 따로 재시도하면 문단 하나에 요청을 두 배로 쓴다.
    prompt = [
      buildPrompt(key, input),
      "",
      "[재작성 요청] 직전 응답에 아래 문제가 있었다.",
      report.retryNote,
    ].join("\n");
  }

  return done(toParagraph(key, spec.fallback(input), "fallback"));
}

/** 통합 호출 1회. JSON 을 파싱해 키별 문자열로 돌려준다. 실패하면 throw. */
async function callCombined(
  keys: ParagraphKey[],
  input: ReportInput,
  extraNote = "",
): Promise<Partial<Record<ParagraphKey, string>>> {
  const raw = await generateText({
    system: SYSTEM_PROMPT,
    prompt: buildCombinedPrompt(keys, input) + extraNote,
    // 문단 6개가 한 응답에 들어오므로 단건(1024)의 여러 배가 필요하다.
    maxTokens: MAX_TOKENS * keys.length,
    thinking: "low",
    jsonSchema: combinedSchema(keys),
    // 응답이 길어진 만큼 넉넉히. 그래도 함수 한도(60s) 안쪽이다.
    timeoutMs: 40_000,
  });

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const out: Partial<Record<ParagraphKey, string>> = {};
  for (const key of keys) {
    const v = parsed[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

/**
 * 문단 6개를 **한 번의 호출로** 생성한다.
 *
 * ⚠️ 예전엔 문단마다 따로 불러 6요청을 썼다. 무료 티어는 분당 "요청 수" 로 한도를
 *    재므로(모델당 20 RPM) 사업계획서 1회 생성이 6요청이면 **분당 3회면 한도**다.
 *    심사위원 몇 명이 동시에 누르면 그 자리에서 429 로 떨어졌다.
 *    하나로 묶어 분당 20회까지 늘렸다.
 *
 * 검증은 **여전히 문단별**이다. 환각이 있는 문단만 모아 한 번 더 부르고,
 * 그래도 남으면 그 문단만 폴백으로 떨어뜨린다 (최대 2요청).
 *
 * `onProgress` 는 문단 하나가 검증을 통과할 때마다 호출된다. 06b SSE 진행률에 쓴다.
 */
export async function generateParagraphs(
  input: ReportInput,
  onProgress?: (done: number, total: number, key: ParagraphKey) => void,
): Promise<GenerateResult> {
  const startedAt = Date.now();
  const total = PARAGRAPH_KEYS.length;
  const allowed = collectAllowedNumbers(input);

  const paragraphs = {} as Record<ParagraphKey, Paragraph>;
  const diag = new Map<ParagraphKey, ParagraphDiagnostic>();
  let completed = 0;

  const settle = (key: ParagraphKey, p: Paragraph, d: Omit<ParagraphDiagnostic, "key" | "elapsedMs">) => {
    paragraphs[key] = p;
    diag.set(key, { key, elapsedMs: Date.now() - startedAt, ...d });
    completed++;
    onProgress?.(completed, total, key);
  };

  let pending: ParagraphKey[] = [...PARAGRAPH_KEYS];
  const hallucinated = new Map<ParagraphKey, string[][]>();
  const violated = new Map<ParagraphKey, string[][]>();
  /** 2차 재작성 지시문 — 문단별로 "무엇이 왜 틀렸는지"를 그대로 넘긴다 */
  const retryNotes = new Map<ParagraphKey, string>();
  let lastError: string | undefined;

  // 1차 통합 호출 → 검사에 걸린 문단만 2차로 한 번 더. 그 이상은 시간만 쓴다.
  for (let attempt = 1; attempt <= 2 && pending.length; attempt++) {
    let got: Partial<Record<ParagraphKey, string>>;
    try {
      const note =
        attempt === 1
          ? ""
          : "\n\n[재작성 요청] 직전 응답의 아래 문단이 검사에 걸렸다. 지적된 것만 고쳐 다시 작성하라.\n" +
            pending
              .map((k) => `### ${k}\n${retryNotes.get(k) ?? "- 응답이 비어 있었다."}`)
              .join("\n");
      got = await callCombined(pending, input, note);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      break; // 호출 자체가 실패하면 재시도해도 대개 같다 — 남은 문단은 폴백
    }

    const stillBad: ParagraphKey[] = [];
    for (const key of pending) {
      const text = got[key];
      if (!text) {
        stillBad.push(key);
        continue;
      }
      const report = inspectOutput(text, allowed);
      if (report.clean) {
        settle(key, toParagraph(key, text, "ai"), {
          source: "ai",
          attempts: attempt,
          hallucinations: hallucinated.get(key) ?? [],
          violations: violated.get(key) ?? [],
        });
        continue;
      }
      if (report.offenders.length) {
        hallucinated.set(key, [...(hallucinated.get(key) ?? []), report.offenders]);
      }
      if (report.violations.length) {
        const matched = report.violations.map((v) => v.matched);
        violated.set(key, [...(violated.get(key) ?? []), matched]);
      }
      retryNotes.set(key, report.retryNote);
      lastError = report.message;
      stillBad.push(key);
    }
    pending = stillBad;
  }

  // 두 번 시도하고도 남은 문단은 규칙기반 문장으로 채운다.
  for (const key of pending) {
    settle(key, toParagraph(key, PARAGRAPH_SPECS[key].fallback(input), "fallback"), {
      source: "fallback",
      attempts: 2,
      hallucinations: hallucinated.get(key) ?? [],
      violations: violated.get(key) ?? [],
      error: lastError,
    });
  }

  return {
    paragraphs,
    // 진단은 문단 순서로 (완료 순서가 아니라) — 화면 표가 서식 순서를 따른다.
    diagnostics: PARAGRAPH_KEYS.map((k) => diag.get(k)!),
  };
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
