/**
 * 자연어 → 구조화 폼 (#10).
 *
 * **생성 AI 우선, 규칙 폴백.** 키가 있으면 Gemini 가 문장에서 필드를 뽑고,
 * 없거나 실패하면 미리 추가한 케이스에서 결과를 돌려준다. 응답의 `source` 로 구분한다.
 *
 * ## 뽑은 값을 그대로 믿지 않는다
 *
 * 파싱은 **환각이 제일 티가 안 나는 지점**이다. 문장에 없는 톤수를 그럴듯하게 채워 넣으면
 * 폼은 정상으로 보이고 매칭까지 성공한 것처럼 돌아간다. 틀린 건 결과뿐이다.
 *
 * 그래서 두 가지를 코드가 확인한다.
 *   1. **숫자는 원문에 있어야 한다** — `tons` 가 문장에 없으면 그 필드를 버린다
 *   2. **품목·기업구분은 enum 밖으로 못 나간다** — 화면이 칩 선택이라 자유 텍스트면 폼이 깨진다
 *
 * 버릴 때는 조용히 비우지 않고 `warnings` 에 사유를 남긴다. 사용자가 직접 채우면 된다.
 */

import { generateText, isLlmConfigured } from "./llm";

export const DEMO_NOTICE =
  "데모 버전입니다 — LLM 파싱 대신 미리 추가한 케이스에서 결과를 반환합니다. (케이스를 추가해뒀어요)";

/** 생성 AI 가 실제로 뽑았을 때의 안내 */
export const AI_NOTICE = "문장에서 자동으로 채웠습니다. 배지가 붙은 항목을 확인해 주세요.";

export interface ParseField<T> {
  value: T | null;
  source: "ai" | "none";
  confidence?: number;
  /** item 처럼 enum 으로 강제되는 필드의 코드값 */
  enum?: string;
}

export interface ParsedFreight {
  origin: ParseField<string>;
  destination: ParseField<string>;
  item: ParseField<string>; // 한글 품목(ItemCategory)
  tons: ParseField<number>;
  departDate: ParseField<string>;
  corpType: ParseField<string>;
}

export interface ParseCase {
  id: string;
  label: string;
  /** 화면에 보여줄 예시 입력 문장 */
  text: string;
  /** 이 텍스트가 들어오면 이 케이스로 매칭 */
  keywords: string[];
  fields: ParsedFreight;
  warnings: string[];
}

export interface ParseResponse {
  /** 규칙(케이스) 경로로 나온 결과인지. `source === "rule"` 과 같다 */
  demo: boolean;
  /** 어느 경로로 나왔는지 — 화면 배지가 이걸 본다 */
  source: "ai" | "rule";
  notice: string;
  /** 규칙 경로일 때 어떤 케이스를 썼는지. AI 경로면 빈 문자열 */
  caseId: string;
  fields: ParsedFreight;
  warnings: string[];
}

const ai = <T>(value: T, confidence: number, enumCode?: string): ParseField<T> => ({
  value,
  source: "ai",
  confidence,
  ...(enumCode ? { enum: enumCode } : {}),
});
const none = <T>(): ParseField<T> => ({ value: null, source: "none" });

export const PARSE_CASES: ParseCase[] = [
  {
    id: "petrochem-uls-gg",
    label: "울산→경기 · 석유화학제품 8톤",
    text: "울산 공장에서 경기 물류센터까지 석유화학제품 8톤, 다음주 화요일 출발",
    keywords: ["석유화학", "울산 공장", "경기"],
    fields: {
      origin: ai("울산 공장", 0.94),
      destination: ai("경기 물류센터", 0.91),
      item: ai("석유화학제품", 0.88, "PETROCHEM"),
      tons: ai(8, 0.97),
      departDate: ai("2026-08-18", 0.72),
      corpType: none(),
    },
    warnings: ["희망 출발일이 상대 날짜로 표현되어 추정했습니다"],
  },
  {
    id: "steel-uls-pt",
    label: "울산→평택 · 철강재 3톤",
    text: "울산 효문공장에서 평택 산업재 창고로 철강재 밸브 3톤, 20일 출발 희망",
    keywords: ["철강", "밸브", "평택"],
    fields: {
      origin: ai("울산 효문공장", 0.92),
      destination: ai("평택 산업재 창고", 0.9),
      item: ai("철강재", 0.85, "STEEL"),
      tons: ai(3, 0.95),
      departDate: ai("2026-08-20", 0.9),
      corpType: none(),
    },
    warnings: [],
  },
  {
    id: "chem-bs-sudo",
    label: "부산→수도권 · 화학원료 12톤",
    text: "부산신항에서 수도권까지 화학원료 12톤, 이번 주 금요일까지 도착 필요",
    keywords: ["화학원료", "부산"],
    fields: {
      origin: ai("부산신항", 0.9),
      destination: ai("수도권 물류센터", 0.8),
      item: ai("화학원료", 0.86, "CHEM_MATERIAL"),
      tons: ai(12, 0.96),
      departDate: none(),
      corpType: none(),
    },
    warnings: ["도착 기한만 언급되어 출발일은 추정하지 못했습니다"],
  },
];

/** 데모 케이스 목록 (화면 picker 용) */
export function listParseCases() {
  return PARSE_CASES.map((c) => ({ id: c.id, label: c.label, text: c.text }));
}

/**
 * 파싱 실행 (데모). caseId 로 직접 고르거나, text 의 키워드로 케이스를 매칭한다.
 * 아무것도 안 맞으면 첫 케이스로 폴백한다.
 */
export function parseFreightText(input: { text?: string; caseId?: string }): ParseResponse {
  let picked: ParseCase | undefined;
  if (input.caseId) picked = PARSE_CASES.find((c) => c.id === input.caseId);
  if (!picked && input.text) {
    const t = input.text;
    picked = PARSE_CASES.find((c) => c.keywords.some((k) => t.includes(k)));
  }
  if (!picked) picked = PARSE_CASES[0];

  return {
    demo: true,
    source: "rule",
    notice: DEMO_NOTICE,
    caseId: picked.id,
    fields: picked.fields,
    warnings: picked.warnings,
  };
}

// ── LLM 경로 ───────────────────────────────────────────────────

/** 화면이 칩으로 고르는 값들. 여기 밖으로 나가면 폼이 깨진다. */
const ITEM_ENUM: Record<string, string> = {
  석유화학제품: "PETROCHEM",
  화학원료: "CHEM_MATERIAL",
  철강재: "STEEL",
  기타: "ETC",
};
const CORP_TYPES = ["중소기업", "우수물류기업", "일반"];

const SYSTEM_PROMPT = `너는 화물 운송 주문 문장에서 등록 폼 필드를 뽑는 추출기다.

절대 규칙:
1. **문장에 없는 값을 만들지 마라.** 없으면 null 을 넣어라. 추측·보완·기본값 금지.
2. 숫자는 문장에 적힌 그대로 쓴다. 단위를 환산하거나 반올림하지 마라.
3. 품목은 [석유화학제품, 화학원료, 철강재, 기타] 중 하나다. 애매하면 "기타".
4. 기업 구분은 [중소기업, 우수물류기업, 일반] 중 하나이며, **문장에 언급이 없으면 null** 이다.
5. 상대 날짜("다음주 화요일")는 주어진 오늘 날짜 기준으로 환산하고, 확신이 낮으면 confidence 를 낮춰라.
6. confidence 는 0~1 이다. 문장에 명시된 값은 높게, 환산·추론한 값은 낮게 준다.
7. 출발지·도착지는 **문장에 나온 표현 그대로** 옮긴다. 역 이름으로 바꾸지 마라 (역 매칭은 화면이 따로 한다).

예시 — 이렇게 하지 마라:
  입력 "부산에서 수도권까지 화학원료 12톤, 금요일까지 도착 필요"
  출력 departDate: "2026-08-19"   ← 도착 기한만 있고 출발일은 없다. **null 이어야 한다**

warnings 에는 추론한 항목과 그 이유를 한 줄씩 적어라. 없으면 빈 배열.`;

const PARSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    origin: { type: ["string", "null"] },
    originConfidence: { type: "number" },
    destination: { type: ["string", "null"] },
    destinationConfidence: { type: "number" },
    item: { type: ["string", "null"], enum: [...Object.keys(ITEM_ENUM), null] },
    itemConfidence: { type: "number" },
    tons: { type: ["number", "null"] },
    tonsConfidence: { type: "number" },
    departDate: { type: ["string", "null"] },
    departDateConfidence: { type: "number" },
    corpType: { type: ["string", "null"], enum: [...CORP_TYPES, null] },
    corpTypeConfidence: { type: "number" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "origin", "originConfidence", "destination", "destinationConfidence",
    "item", "itemConfidence", "tons", "tonsConfidence",
    "departDate", "departDateConfidence", "corpType", "corpTypeConfidence", "warnings",
  ],
  additionalProperties: false,
};

/** 문장에 그 숫자가 실제로 적혀 있는지. `8톤` · `8 톤` · `8t` 를 모두 본다. */
function numberAppears(text: string, n: number): boolean {
  const plain = String(n);
  if (text.includes(plain)) return true;
  // "1,200" 처럼 천단위 콤마가 찍힌 경우
  return text.includes(n.toLocaleString("en-US"));
}

const field = <T>(
  value: T | null,
  confidence: unknown,
  enumCode?: string,
): ParseField<T> =>
  value === null || value === undefined
    ? none<T>()
    : ai(value, typeof confidence === "number" ? confidence : 0.5, enumCode);

/**
 * 생성 AI 로 파싱한다. **실패하면 throw** — 호출부가 규칙 경로로 폴백한다.
 *
 * `today` 는 상대 날짜 환산 기준이다. 서버 시각을 그냥 쓰면 테스트가 날짜에 따라 흔들린다.
 */
export async function parseFreightWithLlm(
  text: string,
  today: Date = new Date(),
): Promise<ParseResponse> {
  const raw = await generateText({
    system: SYSTEM_PROMPT,
    prompt: [
      `[오늘 날짜] ${today.toISOString().slice(0, 10)}`,
      `[입력 문장]`,
      text,
    ].join("\n"),
    maxTokens: 1024,
    // 필드 추출이라 깊은 추론이 필요 없다. 화면에서 버튼 누르고 기다리는 자리다.
    thinking: "low",
    jsonSchema: PARSE_SCHEMA,
    timeoutMs: 20_000,
  });

  const r = JSON.parse(raw) as Record<string, unknown>;
  const warnings = Array.isArray(r.warnings) ? r.warnings.filter((w) => typeof w === "string") : [];

  // ── 검사 — 뽑은 값이 원문에 근거하는지 ──────────────────────
  let tons: number | null = typeof r.tons === "number" ? r.tons : null;
  if (tons !== null && !numberAppears(text, tons)) {
    // 문장에 없는 중량을 채우면 폼은 정상으로 보이고 매칭까지 돈다. 결과만 틀린다.
    warnings.push(`문장에 없는 중량(${tons}톤)이 나와 비워 뒀습니다 — 직접 입력해 주세요.`);
    tons = null;
  }

  const itemName = typeof r.item === "string" && r.item in ITEM_ENUM ? r.item : null;
  const corpType = typeof r.corpType === "string" && CORP_TYPES.includes(r.corpType) ? r.corpType : null;

  return {
    demo: false,
    source: "ai",
    notice: AI_NOTICE,
    caseId: "",
    fields: {
      origin: field(typeof r.origin === "string" ? r.origin : null, r.originConfidence),
      destination: field(typeof r.destination === "string" ? r.destination : null, r.destinationConfidence),
      item: field(itemName, r.itemConfidence, itemName ? ITEM_ENUM[itemName] : undefined),
      tons: field(tons, r.tonsConfidence),
      departDate: field(typeof r.departDate === "string" ? r.departDate : null, r.departDateConfidence),
      corpType: field(corpType, r.corpTypeConfidence),
    },
    warnings,
  };
}

/**
 * 파싱 실행 — **AI 우선, 규칙 폴백.**
 *
 * `caseId` 가 오면 화면이 데모 케이스를 고른 것이므로 AI 를 부르지 않는다.
 */
export async function parseFreight(
  input: { text?: string; caseId?: string },
  today: Date = new Date(),
): Promise<ParseResponse> {
  if (!input.caseId && input.text?.trim() && isLlmConfigured()) {
    try {
      return await parseFreightWithLlm(input.text, today);
    } catch {
      // 폴백 경로다. 사유는 notice 가 아니라 warnings 로 알린다 — notice 는 케이스 안내를 쓴다.
      const fallback = parseFreightText(input);
      return {
        ...fallback,
        warnings: [...fallback.warnings, "AI 파싱에 실패해 준비된 케이스로 대체했습니다."],
      };
    }
  }
  return parseFreightText(input);
}
