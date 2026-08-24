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
  /**
   * 희망 출발일을 오늘 + n일로 채운다. 생략하면 `fields.departDate` 를 그대로 쓴다
   * (출발일이 아예 없는 케이스). **절대 날짜를 박지 말 것** — 며칠이면 과거가 된다.
   */
  departOffsetDays?: number;
  fields: ParsedFreight;
  warnings: string[];
}

/**
 * 상대 날짜를 어떻게 환산했는지. 화면이 "'내일' → 8월 25일 (화)" 처럼 그린다.
 * `kind === "arrival"` 이면 출발일이 아니라 도착 기한이라 폼에는 안 넣었다는 뜻이다.
 */
export interface DateResolution {
  /** 원문에서 잡은 표현 — "내일", "다음주 토요일", "금주까지" */
  expression: string;
  date: string;
  /** 환산 기준일 (YYYY-MM-DD) */
  today: string;
  kind: "depart" | "arrival";
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
  /** 문장에 상대 날짜 표현이 있었으면 어떻게 환산했는지. 없으면 null */
  dateResolution: DateResolution | null;
}

/** 생성 AI 가 붙어 있을 때 GET 이 주는 안내 */
export const AI_READY_NOTICE = "문장을 적고 'AI로 채우기'를 누르면 항목을 읽어 채웁니다.";

/** GET /api/freights/parse 가 쓰는 상태 — AI 가 붙어 있는지에 따라 배지·안내가 갈린다 */
export function parseStatus(): { demo: boolean; notice: string } {
  const demo = !isLlmConfigured();
  return { demo, notice: demo ? DEMO_NOTICE : AI_READY_NOTICE };
}

const ai = <T>(value: T, confidence: number, enumCode?: string): ParseField<T> => ({
  value,
  source: "ai",
  confidence,
  ...(enumCode ? { enum: enumCode } : {}),
});
const none = <T>(): ParseField<T> => ({ value: null, source: "none" });

/**
 * 데모 케이스.
 *
 * ## 두 가지를 반드시 지킨다
 *
 * 1. **출발일은 상대 오프셋으로 둔다** (`departOffsetDays`). 절대 날짜를 박아 두면
 *    며칠 뒤 전부 과거가 되어, 예시를 눌러 채운 폼이 매칭에서 통째로 탈락한다
 *    (실제로 "2026-08-18" 이 박혀 있어 그렇게 썩었다).
 * 2. **역 마스터에 있는 지명만 쓴다.** 화면은 이 문장의 지명을 역 이름·지역명으로
 *    맞춰 폼을 채운다(`matchStation`). 마스터에 없는 곳을 쓰면 역 칸이 빈 채로
 *    남아 "AI가 못 채웠다"처럼 보인다.
 */
export const PARSE_CASES: ParseCase[] = [
  {
    id: "petrochem-uls-obong",
    label: "울산→오봉 · 석유화학제품 8톤",
    text: "울산 공장에서 경기 의왕 물류센터까지 석유화학제품 8톤, 모레 출발",
    keywords: ["석유화학", "울산 공장", "의왕"],
    departOffsetDays: 2,
    fields: {
      origin: ai("울산 공장", 0.94),
      destination: ai("경기 의왕 물류센터", 0.91),
      item: ai("석유화학제품", 0.88, "PETROCHEM"),
      tons: ai(8, 0.97),
      departDate: ai("", 0.72),
      corpType: none(),
    },
    warnings: ["희망 출발일이 상대 날짜로 표현되어 추정했습니다"],
  },
  {
    id: "steel-uls-obong",
    label: "울산→오봉 · 철강재 3톤",
    text: "울산화물역에서 오봉역으로 철강재 밸브 3톤, 모레 출발 희망",
    keywords: ["철강", "밸브", "울산화물역"],
    departOffsetDays: 2,
    fields: {
      origin: ai("울산화물역", 0.96),
      destination: ai("오봉역", 0.95),
      item: ai("철강재", 0.85, "STEEL"),
      tons: ai(3, 0.95),
      departDate: ai("", 0.9),
      corpType: none(),
    },
    warnings: [],
  },
  {
    id: "container-bsj-obong",
    label: "부산진→오봉 · 컨테이너 철강재 9톤",
    text: "부산진역에서 경기 의왕까지 철강재 9톤 컨테이너로 보냅니다. 모레 출발이면 됩니다",
    keywords: ["부산진", "컨테이너"],
    departOffsetDays: 2,
    fields: {
      origin: ai("부산진역", 0.95),
      destination: ai("경기 의왕", 0.9),
      item: ai("철강재", 0.87, "STEEL"),
      tons: ai(9, 0.96),
      departDate: ai("", 0.8),
      corpType: none(),
    },
    warnings: [],
  },
  {
    id: "chem-ons-obong",
    label: "온산→오봉 · 화학원료 16톤 (탱크)",
    text: "온산역에서 오봉역까지 화학원료 16톤, 탱크화차로 3일 뒤 출발",
    keywords: ["온산", "탱크", "화학원료"],
    departOffsetDays: 3,
    fields: {
      origin: ai("온산역", 0.95),
      destination: ai("오봉역", 0.94),
      item: ai("화학원료", 0.89, "CHEM_MATERIAL"),
      tons: ai(16, 0.97),
      departDate: ai("", 0.85),
      corpType: none(),
    },
    warnings: [],
  },
  {
    id: "coil-gwy-obong",
    label: "광양→오봉 · 코일 11톤",
    text: "광양역에서 경기 의왕까지 철강 코일 11톤, 모레 보내고 싶습니다",
    keywords: ["광양", "코일"],
    departOffsetDays: 2,
    fields: {
      origin: ai("광양역", 0.94),
      destination: ai("경기 의왕", 0.9),
      item: ai("철강재", 0.86, "STEEL"),
      tons: ai(11, 0.95),
      departDate: ai("", 0.8),
      corpType: none(),
    },
    warnings: [],
  },
  {
    id: "cover-jch-obong",
    label: "제천→오봉 · 우천불가 자재 5.5톤",
    text: "제천역에서 오봉역까지 자재 5.5톤인데 비 맞으면 안 됩니다. 사흘 뒤 출발",
    keywords: ["제천", "비 맞으면"],
    departOffsetDays: 3,
    fields: {
      origin: ai("제천역", 0.95),
      destination: ai("오봉역", 0.94),
      item: ai("기타", 0.7, "ETC"),
      tons: ai(5.5, 0.96),
      departDate: ai("", 0.82),
      corpType: none(),
    },
    warnings: ["우천 노출 불가 조건은 폼의 '조건·요청사항'에 그대로 남겨 두세요"],
  },
  {
    id: "return-obong-uls",
    label: "오봉→울산 · 복편 13톤",
    text: "오봉역에서 울산화물역으로 내려가는 물량 13톤입니다. 모레 출발",
    keywords: ["복편", "내려가는", "오봉역에서 울산"],
    departOffsetDays: 2,
    fields: {
      origin: ai("오봉역", 0.95),
      destination: ai("울산화물역", 0.94),
      item: ai("기타", 0.72, "ETC"),
      tons: ai(13, 0.96),
      departDate: ai("", 0.8),
      corpType: none(),
    },
    warnings: [],
  },
  {
    id: "arrival-only-uls-obong",
    label: "울산→오봉 · 출발일 없음 (도착 기한만)",
    text: "울산화물역에서 경기 의왕까지 화학원료 12톤, 이번 주 안에 도착만 하면 됩니다",
    keywords: ["이번 주 안에", "도착만"],
    fields: {
      origin: ai("울산화물역", 0.95),
      destination: ai("경기 의왕", 0.9),
      item: ai("화학원료", 0.86, "CHEM_MATERIAL"),
      tons: ai(12, 0.96),
      departDate: none(),
      corpType: none(),
    },
    warnings: ["도착 기한만 언급되어 출발일은 추정하지 못했습니다"],
  },
];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 오늘 + n일 (로컬 달력 기준 — UTC 로 계산하면 KST 자정 직후 하루가 밀린다) */
function offsetDate(days: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** 상대 오프셋을 오늘 기준 날짜로 채운 사본. 케이스 원본은 건드리지 않는다. */
function withToday(c: ParseCase): ParsedFreight {
  if (c.departOffsetDays === undefined) return c.fields;
  return {
    ...c.fields,
    departDate: { ...c.fields.departDate, value: offsetDate(c.departOffsetDays) },
  };
}

/**
 * 상대 날짜 표현 → 오늘 기준 오프셋(일).
 *
 * AI 든 규칙 경로든 이 표가 **유일한 기준**이다. LLM 은 날짜 계산을 가끔 틀리므로
 * (예: "모레"를 +1 로 셈) 문장에 이 표현이 있으면 LLM 결과를 이 값으로 덮어쓴다.
 * 숫자(N일 뒤/후)와 요일·주 표현은 아래 `DATE_MATCHERS` 에서 정규식으로 따로 다룬다.
 */
const RELATIVE_DATE_KEYWORDS: Array<{ pattern: RegExp; offset: number }> = [
  { pattern: /오늘/g, offset: 0 },
  { pattern: /내일|명일/g, offset: 1 },
  { pattern: /모레/g, offset: 2 },
  { pattern: /글피/g, offset: 3 },
  { pattern: /사흘\s*(?:뒤|후)/g, offset: 3 },
  { pattern: /나흘\s*(?:뒤|후)/g, offset: 4 },
  { pattern: /닷새\s*(?:뒤|후)/g, offset: 5 },
  { pattern: /엿새\s*(?:뒤|후)/g, offset: 6 },
  { pattern: /이레\s*(?:뒤|후)/g, offset: 7 },
];

const WEEKDAY_INDEX: Record<string, number> = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
/** "다음주"/"차주"/"담주" 계열 — "이번주"/"금주" 와 구분하는 데 쓴다 */
const NEXT_WEEK_PREFIX = /다음\s*주|차주|담주/;

/** 그 날이 속한 주의 월요일 (로컬 달력 기준, 월요일 시작) */
function mondayOf(base: Date): Date {
  const d = new Date(base);
  const mondayBasedIdx = (d.getDay() + 6) % 7; // 월=0 ... 일=6
  d.setDate(d.getDate() - mondayBasedIdx);
  return d;
}

/** 이번주(0)·다음주(1) 의 `dayIdx`(월=0…일=6) 번째 날 */
function dayOfWeek(today: Date, weekOffset: number, dayIdx: number): string {
  const d = mondayOf(today);
  d.setDate(d.getDate() + weekOffset * 7 + dayIdx);
  return toIsoDate(d);
}

/** 오늘 이후 가장 가까운 그 요일 (오늘이 해당 요일이면 오늘) */
function nearestWeekday(today: Date, dayIdx: number): string {
  const todayIdx = (today.getDay() + 6) % 7;
  const delta = (dayIdx - todayIdx + 7) % 7;
  return offsetDate(delta, today);
}

interface DateMatch {
  /** 문장 안 위치 — 어느 절(출발/도착)에 속하는지 볼 때 쓴다 */
  index: number;
  /** 원문에서 잡힌 표현 그대로 — 화면이 "'내일' → …" 로 보여준다 */
  expression: string;
  date: string;
}

/**
 * 문장에서 날짜 표현을 **전부** 찾는다. 한 문장에 "모레 출발, 금요일까지 도착"처럼
 * 둘 이상 올 수 있어서 하나만 뽑으면 안 된다.
 */
function findDateMatches(text: string, today: Date): DateMatch[] {
  const out: DateMatch[] = [];

  // "다음주 토요일" / "금주 목요일" / "토요일"
  for (const m of text.matchAll(/(이번\s*주|금주|다음\s*주|차주|담주)?\s*(월|화|수|목|금|토|일)요일/g)) {
    const dayIdx = WEEKDAY_INDEX[m[2]];
    const date = m[1]
      ? dayOfWeek(today, NEXT_WEEK_PREFIX.test(m[1]) ? 1 : 0, dayIdx)
      : nearestWeekday(today, dayIdx);
    out.push({ index: m.index ?? 0, expression: m[0].trim(), date });
  }

  // "금주까지" / "차주 안에" — 요일 없이 주 단위 마감이면 그 주 일요일
  for (const m of text.matchAll(/(이번\s*주|금주|다음\s*주|차주|담주)\s*(?:까지|안에)/g)) {
    out.push({
      index: m.index ?? 0,
      expression: m[0].trim(),
      date: dayOfWeek(today, NEXT_WEEK_PREFIX.test(m[1]) ? 1 : 0, 6),
    });
  }

  // "5일 뒤" / "3일 후"
  for (const m of text.matchAll(/(\d+)\s*일\s*(?:뒤|후)/g)) {
    out.push({ index: m.index ?? 0, expression: m[0].trim(), date: offsetDate(Number(m[1]), today) });
  }

  for (const { pattern, offset } of RELATIVE_DATE_KEYWORDS) {
    for (const m of text.matchAll(pattern)) {
      out.push({ index: m.index ?? 0, expression: m[0].trim(), date: offsetDate(offset, today) });
    }
  }

  return out.sort((a, b) => a.index - b.index);
}

const DEPART_WORDS = /출발|출고|발송|보내|싣|상차/;
const ARRIVAL_WORDS = /도착|입고|납품|하차|받/;

/**
 * 날짜 표현이 속한 절이 출발인지 도착인지. 절은 쉼표·마침표·줄바꿈으로 자른다.
 * 절 안에 출발·도착 단서가 둘 다 없으면 `"unknown"`.
 */
function clauseKind(text: string, index: number): "depart" | "arrival" | "unknown" {
  const boundary = /[,.\n。、]/;
  let start = index;
  while (start > 0 && !boundary.test(text[start - 1])) start--;
  let end = index;
  while (end < text.length && !boundary.test(text[end])) end++;
  const clause = text.slice(start, end);
  if (DEPART_WORDS.test(clause)) return "depart";
  if (ARRIVAL_WORDS.test(clause)) return "arrival";
  return "unknown";
}

export interface ResolvedDates {
  /** 희망 출발일. 출발 절이 없고 도착 절만 있으면 null */
  depart: string | null;
  /** `depart` 를 만든 원문 표현 */
  departExpr: string | null;
  /** 도착 기한. 폼에는 안 들어가지만 안내 문구에 쓴다 */
  arrival: string | null;
  arrivalExpr: string | null;
}

/**
 * 문장의 상대 날짜 표현을 오늘(`today`) 기준 절대 날짜로 환산해 **출발/도착으로 나눠** 돌려준다.
 *
 * - 출발 절("모레 출발")이 있으면 그 날짜가 `depart`
 * - 출발·도착 단서가 없는 절("모레 보내주세요" 가 아닌 그냥 "모레")은 출발로 본다
 * - 도착 절("금요일까지 도착")만 있으면 `depart` 는 null — 출발일을 지어내지 않는다
 */
export function resolveDates(text: string, today: Date = new Date()): ResolvedDates {
  const matches = findDateMatches(text, today);
  let depart: DateMatch | null = null;
  let unknown: DateMatch | null = null;
  let arrival: DateMatch | null = null;
  for (const m of matches) {
    const kind = clauseKind(text, m.index);
    if (kind === "depart" && depart === null) depart = m;
    else if (kind === "arrival" && arrival === null) arrival = m;
    else if (kind === "unknown" && unknown === null) unknown = m;
  }
  const d = depart ?? unknown;
  return {
    depart: d?.date ?? null,
    departExpr: d?.expression ?? null,
    arrival: arrival?.date ?? null,
    arrivalExpr: arrival?.expression ?? null,
  };
}

/** `resolveDates` 결과를 응답용으로. 출발이 있으면 출발, 아니면 도착, 둘 다 없으면 null */
function toDateResolution(r: ResolvedDates, today: Date): DateResolution | null {
  const todayIso = toIsoDate(today);
  if (r.depart && r.departExpr) return { expression: r.departExpr, date: r.depart, today: todayIso, kind: "depart" };
  if (r.arrival && r.arrivalExpr) return { expression: r.arrivalExpr, date: r.arrival, today: todayIso, kind: "arrival" };
  return null;
}

/** `resolveDates(...).depart` 단축. 표현이 없거나 도착 기한만 있으면 `null`. */
export function resolveRelativeDate(text: string, today: Date = new Date()): string | null {
  return resolveDates(text, today).depart;
}

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

  // 케이스의 departOffsetDays 는 예시 문장용 고정값이다. 실제 입력 문장에
  // "내일"·"모레" 같은 표현이 있으면 그 문장 기준으로 다시 계산해 덮어쓴다.
  // caseId 로 고른 경우는 예시 문장을 그대로 쓰는 것이므로 케이스 값을 신뢰한다.
  let fields = withToday(picked);
  const warnings = [...picked.warnings];
  let dateResolution: DateResolution | null = null;
  if (!input.caseId && input.text) {
    const today = new Date();
    const resolved = resolveDates(input.text, today);
    dateResolution = toDateResolution(resolved, today);
    if (resolved.depart) fields = { ...fields, departDate: ai(resolved.depart, 0.95) };
    else if (resolved.arrival) {
      fields = { ...fields, departDate: none() };
      warnings.push(`도착 기한(${resolved.arrival})만 언급되어 출발일은 추정하지 못했습니다.`);
    }
  }

  return {
    demo: true,
    source: "rule",
    notice: DEMO_NOTICE,
    caseId: picked.id,
    fields,
    warnings,
    dateResolution,
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
   (오늘/내일/모레/요일/금주·차주 같은 흔한 표현은 코드가 다시 계산해 덮어쓰므로 정확도에 집착하지 않아도 된다.)
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
export function numberAppears(text: string, n: number): boolean {
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

  // "오늘/내일/모레/다음주 토요일" 같은 표현은 LLM 계산에 맡기지 않고 코드 기준으로 덮어쓴다.
  // LLM 이 날짜 산수를 가끔 틀리기 때문에(예: "모레"를 +1일로 셈) 결정론적 값이 우선한다.
  // 도착 기한만 있는 문장이면 LLM 이 출발일을 채웠더라도 비운다 — 지어낸 값이다.
  let departDateValue = typeof r.departDate === "string" ? r.departDate : null;
  let departDateConfidence: unknown = r.departDateConfidence;
  const resolved = resolveDates(text, today);
  const dateResolution = toDateResolution(resolved, today);
  let finalWarnings = warnings;
  if (dateResolution) {
    // 코드가 날짜를 확정했으면 LLM 이 남긴 날짜 관련 경고는 뺀다 — 같은 얘기를 두 번 하거나
    // ("'내일'을 08-25 로 환산함") 코드 결과와 어긋나는 문장이 남는다. 화면은 dateResolution 을 그린다.
    finalWarnings = warnings.filter((w) => !/departDate|출발일|날짜/.test(w));
  }
  if (resolved.depart) {
    departDateValue = resolved.depart;
    departDateConfidence = 0.95;
  } else if (resolved.arrival) {
    // 도착 기한만 있는데 LLM 이 출발일을 채웠다면 지어낸 값이다. 비운다.
    departDateValue = null;
  }

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
      departDate: field(departDateValue, departDateConfidence),
      corpType: field(corpType, r.corpTypeConfidence),
    },
    warnings: finalWarnings,
    dateResolution,
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
