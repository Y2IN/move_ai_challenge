/**
 * K-ESG 공시 리포트 문단 생성 (api_list #41 — LLM ✅).
 *
 * 설계 원칙 3개:
 *
 *  1. **숫자는 LLM이 만들지 않는다.** 계산된 수치를 프롬프트에 넣고 문장만 쓰게 한 뒤,
 *     생성 결과에서 입력에 없는 숫자가 나오면 재생성한다 (`report/verify.ts`).
 *  2. **병렬 호출.** 문단 5개를 순차로 돌리면 서버리스 실행 시간 제한에 걸린다.
 *  3. **폴백은 필수 경로다.** 키가 없든 네트워크가 끊기든 문서는 나온다. 배지만 달라진다.
 */

import Anthropic from "@anthropic-ai/sdk";
import { claudeAuthMode, CLAUDE_MODEL, tryGetClaude } from "../claude";
import { collectAllowedNumbers, findHallucinatedNumbers } from "../report/verify";
import { buildIndicators, SCOPE3_CATEGORY } from "./indicators";
import { buildFacts, PARAGRAPHS, type ParagraphSpec } from "./paragraphs";
import type { EsgAggregate, EsgReport, EsgSection, EsgSectionKey } from "./types";

/** 화면 하단 고정 문구. 카피가 아니라 이 모듈이 지키는 계약입니다. */
export const DISCLAIMER =
  "수치는 법정 산식과 고정 계수로 계산되며, AI는 서술 문장만 작성합니다.";

/** 문단 하나는 짧습니다. 길어지면 공시 문서 톤이 아니라 홍보문이 됩니다. */
const MAX_TOKENS = 2000;
/** 해커톤 현장 네트워크를 믿지 않습니다. 오래 물고 있느니 폴백이 낫습니다. */
const REQUEST_TIMEOUT_MS = 25_000;
/**
 * 병렬 호출 사이 간격(ms).
 *
 * 문단 5개를 같은 순간에 던지면 계정 요청 한도(429)를 스스로 유발합니다.
 * 실제로 계정 세션으로 테스트하다 5개가 동시에 429를 맞고 전부 폴백으로 떨어졌습니다.
 * 조금씩 어긋나게 쏘면 총 지연은 0.6초만 늘고 429는 크게 줄어듭니다.
 * (순차 호출은 서버리스 실행 시간 제한에 걸리므로 선택지가 아닙니다)
 */
const STAGGER_MS = 150;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429·529 는 "지금 붐빈다"는 뜻이라 사용자에게 다르게 설명해야 합니다. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return "요청 한도(429)에 걸렸습니다. 잠시 후 '다시 생성'을 누르면 AI 문장으로 채워집니다";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "인증이 만료됐습니다. `npm run session-token` 으로 세션 토큰을 갱신하세요";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Claude API 에 연결하지 못했습니다 (네트워크)";
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude API 오류 (${error.status})`;
  }
  return error instanceof Error ? error.message : String(error);
}

const SYSTEM_PROMPT = `당신은 국내 제조·물류 기업의 ESG 공시 담당자입니다.
K-ESG 가이드라인·GRI·ISSB 기준에 맞는 지속가능경영보고서 본문을 작성합니다.

절대 규칙:
- 숫자를 새로 만들지 마십시오. 제공된 수치만 인용하고, 계산하거나 추정하지 마십시오.
- 제공되지 않은 수치가 필요하면 그 문장을 쓰지 말고 서술 방식을 바꾸십시오.
- 검증받지 않은 것을 검증받은 것처럼, 계획을 실적처럼 쓰지 마십시오.
- 온실가스 감축은 "배출하지 않은 양"입니다. "흡수", "상쇄"로 쓰지 마십시오.

문체:
- 공시 문서체. "~하였다", "~이다" 로 끝나는 평서형 국문.
- 3~5문장 한 문단. 제목·목록·마크다운 없이 문단 텍스트만 출력.
- 홍보성 수식어("혁신적", "획기적", "선도적")를 쓰지 마십시오.`;

function userPrompt(spec: ParagraphSpec, facts: unknown, retry: boolean): string {
  return [
    `# 작성할 문단`,
    `제목: ${spec.title}`,
    `대응 공시 기준: ${spec.standard}`,
    `내용 지침: ${spec.brief}`,
    ``,
    `# 인용 가능한 수치 (이 안의 값만 사용)`,
    "```json",
    JSON.stringify(facts, null, 2),
    "```",
    ``,
    retry
      ? `# 재작성 지시\n직전 출력에 위 데이터에 없는 숫자가 포함되었습니다. ` +
        `위 JSON에 그대로 있는 값만 쓰고, 확신이 없으면 숫자를 빼고 서술하십시오.`
      : ``,
    `문단 텍스트만 출력하십시오.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function callClaude(
  client: Anthropic,
  spec: ParagraphSpec,
  facts: unknown,
  retry: boolean,
): Promise<string> {
  const message = await client.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      // 짧은 서술 문단이라 깊은 추론이 필요 없습니다. effort 를 낮춰 지연을 줄입니다.
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(spec, facts, retry) }],
    },
    { timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 },
  );
  return extractText(message);
}

/**
 * 문단 1개 생성. 실패해도 예외를 던지지 않습니다 — 항상 문단이 나옵니다.
 *
 * 흐름: 생성 → 숫자 검증 → (환각이면) 1회 재생성 → 그래도 환각이면 폴백.
 */
async function generateSection(
  client: Anthropic | null,
  spec: ParagraphSpec,
  agg: EsgAggregate,
  facts: unknown,
  allowed: Set<string>,
): Promise<EsgSection> {
  const base = { key: spec.key, title: spec.title, standard: spec.standard };
  const fallback = (warnings: string[]): EsgSection => ({
    ...base,
    text: spec.fallback(agg),
    source: "fallback",
    warnings,
  });

  if (!client) {
    return fallback([
      "Claude 인증(ANTHROPIC_AUTH_TOKEN 계정 세션 또는 ANTHROPIC_API_KEY)이 없어 템플릿 문장으로 대체했습니다.",
    ]);
  }

  for (const retry of [false, true]) {
    try {
      const text = await callClaude(client, spec, facts, retry);
      if (!text) continue;

      const check = findHallucinatedNumbers(text, allowed);
      if (check.clean) {
        return {
          ...base,
          text,
          source: "ai",
          warnings: retry ? ["1회 재생성 후 숫자 검증을 통과했습니다."] : [],
        };
      }
      if (retry) {
        return fallback([`재생성 후에도 ${check.message} 템플릿 문장으로 대체했습니다.`]);
      }
    } catch (error) {
      return fallback([`${describeError(error)} — 템플릿 문장으로 대체했습니다.`]);
    }
  }

  return fallback(["문단 생성 결과가 비어 있어 템플릿 문장으로 대체했습니다."]);
}

export interface GenerateOptions {
  /** 일부 문단만 다시 생성. 비우면 전체 */
  sections?: EsgSectionKey[];
  /** 이미 만들어 둔 문단 — `sections` 로 일부만 재생성할 때 나머지를 채웁니다 */
  previous?: EsgSection[];
}

/** 문단 전체(또는 지정한 일부)를 생성해 리포트를 조립합니다. */
export async function generateReport(
  agg: EsgAggregate,
  options: GenerateOptions = {},
): Promise<EsgReport> {
  const facts = buildFacts(agg);
  const indicators = buildIndicators(agg);

  // 공시 기준 이름(GRI 305-3 · ISO 14064-3 · IFRS S2 · Cat.4)도 같이 등록합니다.
  // 검출기는 문장 속 숫자와 기준 이름에 박힌 숫자를 구분하지 못하는데,
  // ESG 문단은 근거 기준을 인용하는 게 정상이라 등록해 두지 않으면
  // 올바른 문장이 환각으로 잡혀 매번 폴백으로 떨어집니다.
  const standards = [
    ...PARAGRAPHS.map((p) => p.standard),
    ...indicators.flatMap((i) => i.frameworks),
    SCOPE3_CATEGORY,
  ];

  /**
   * 허용 목록은 **프롬프트에 실제로 들어간 것** 과 정확히 일치해야 합니다.
   * `agg` 전체를 넣으면 안 됩니다. 모델이 본 적 없는 화주별 상세 행까지 등록되어
   * 허용 집합이 5배로 불어나고, 검출기가 그만큼 헐거워집니다.
   *
   * 실제로 그렇게 했더니 어느 행의 `noxReducedKg = 0.997` 이 비율 변형 규칙을 타고
   * "99.7" 로 등록되는 바람에, 지어낸 문장 "제3자 검증기관으로부터 99.7%의 정확도를
   * 확인받았다" 가 검사를 통과했습니다. 공시 문서에서 제일 위험한 종류의 문장입니다.
   */
  const allowed = collectAllowedNumbers({ facts, standards });

  const targets = options.sections?.length
    ? PARAGRAPHS.filter((p) => options.sections!.includes(p.key))
    : PARAGRAPHS;

  // 인증이 없으면 null 이 오고 전 문단이 폴백으로 갑니다. throw 하지 않습니다.
  const client = tryGetClaude();

  // 문단끼리 의존이 없으므로 병렬로 던집니다. 순차 5회는 실행 시간 제한에 걸립니다.
  // 다만 완전히 동시에 쏘면 스스로 429 를 유발하므로 조금씩 어긋나게 출발시킵니다.
  const generated = await Promise.all(
    targets.map(async (spec, i) => {
      if (i > 0) await sleep(i * STAGGER_MS);
      return generateSection(client, spec, agg, facts, allowed);
    }),
  );

  const byKey = new Map<EsgSectionKey, EsgSection>();
  for (const section of options.previous ?? []) byKey.set(section.key, section);
  for (const section of generated) byKey.set(section.key, section);

  // 출력 순서는 항상 서식 순서입니다. 재생성 순서에 흔들리면 안 됩니다.
  const sections = PARAGRAPHS.map((p) => byKey.get(p.key)).filter(
    (s): s is EsgSection => Boolean(s),
  );

  return {
    period: agg.period,
    shipperId: agg.shipperId,
    shipperName: agg.shipperName,
    generatedAt: new Date().toISOString(),
    sections,
    generation: {
      authMode: claudeAuthMode(),
      model: CLAUDE_MODEL,
      aiCount: sections.filter((s) => s.source === "ai").length,
      fallbackCount: sections.filter((s) => s.source === "fallback").length,
    },
    indicators,
    coefficientVersion: agg.coefficientVersion,
    verified: agg.verified,
    disclaimer: DISCLAIMER,
  };
}
