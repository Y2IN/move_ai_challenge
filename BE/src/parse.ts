/**
 * 자연어 → 구조화 폼 (#10) — **데모 버전 (LLM 미연결)**.
 *
 * 지금은 생성 AI 대신 미리 추가한 케이스에서 파싱 결과를 돌려준다.
 * 화면은 케이스를 골라(GET) 파싱을 실행(POST)하면 되고, 응답의 `notice` 에
 * "데모 버전이라 케이스를 추가해뒀다"는 안내가 담긴다.
 *
 * LLM 을 붙일 땐 parseFreightText 내부만 generateText() 호출로 교체하면 된다
 * (응답 스키마 ParseResponse 는 그대로 유지).
 */

export const DEMO_NOTICE =
  "데모 버전입니다 — LLM 파싱 대신 미리 추가한 케이스에서 결과를 반환합니다. (케이스를 추가해뒀어요)";

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
  demo: true;
  notice: string;
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
    notice: DEMO_NOTICE,
    caseId: picked.id,
    fields: picked.fields,
    warnings: picked.warnings,
  };
}
