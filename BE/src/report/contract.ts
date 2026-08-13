/**
 * 리포트 레이어의 입력 계약.
 *
 * **계산 담당과의 유일한 접점이다.** 계수가 바뀌든 산식이 바뀌든
 * 이 타입 모양만 유지되면 리포트 코드는 한 줄도 안 고친다.
 *
 * 리포트는 이 안의 수치를 **읽기만 하고 만들지 않는다.**
 * (제출용 법정 서식이라 환각 숫자가 들어가면 안 된다 — docs/ESG_REPORT_PLAN.md §4.1)
 */

// ── 입력 ───────────────────────────────────────────────────────

export interface ReportPeriod {
  from: string; // "2026-04-01"
  to: string; // "2026-06-30"
  label: string; // "2026년 2분기"
}

/** 서식 1. 신청인 — 계산과 무관. 계정 정보에서 온다. */
export interface Applicant {
  name: string;
  bizNo: string;
  ceo: string;
  manager: string;
  phone: string;
  address: string;
}

/** 서식 2. 전환 계획 */
export interface PlanSection {
  rows: {
    route: string;
    item: string;
    tons: number;
    trips: number;
    wagonType: string;
  }[];
  total: { itemCount: number; tons: number; trips: number; wagonTypeCount: number };
  /** 서술 문단이 인용한다 */
  avgLoadRate: number;
}

/** 서식 3. 추가비용 산출 */
export interface ExtraCostSection {
  rows: { label: string; formula: string; amount: number }[];
  /** 음수 가능. 철도가 도로보다 싸면 전환 추가비용이 발생하지 않는다. */
  totalA: number;
}

/** 서식 4. 사회환경적 편익 */
export interface BenefitSection {
  items: { key: string; label: string; basis: string; source: string; amount: number }[];
  totalB: number;
  /**
   * 협회 공식 원단위로 산정한 사회·환경적 절감액. **보조금 상한(G)의 근거는 이쪽**이다.
   * `items` 4개 항목의 합(`totalB`)은 ESG 대시보드 표시용 추정치라 값이 다르다.
   */
  official: {
    year: number;
    roadUnitCost: number;
    railUnitCost: number;
    roadSocialKrw: number;
    railSocialKrw: number;
    savingKrw: number;
  };
  co2ReducedTon: number;
  co2ReductionRate: number;
  equivalents: { pineTrees: number; trucksBlocked: number };
}

/** 서식 5. 보조금 산정 결과 */
export interface ResultSection {
  A: number;
  B: number;
  adopted: "A" | "B" | "none";
  subsidy: number;
  /**
   * A ≤ 0 이면 false. 이때 서술 문단의 논조가 **완전히 달라진다.**
   * "보조금을 신청합니다" → "추가비용이 발생하지 않아 신청 대상이 아니며 편익은 공시 자산으로 활용합니다"
   */
  eligible: boolean;
  legalBasis: string;
}

export interface ReportInput {
  period: ReportPeriod;
  applicant: Applicant;
  plan: PlanSection;
  extraCost: ExtraCostSection;
  benefit: BenefitSection;
  result: ResultSection;
  /** 서식에 계수 출처로 인쇄된다 */
  coefficientVersion: string;
}

// ── 출력 (서식 구조체) ─────────────────────────────────────────

/**
 * 화면에 "자동 산출 수치" / "AI 서술" 범례가 색으로 구분되어 있으므로
 * 두 계열을 스키마에서 분리한다. `computed` 에는 LLM이 절대 개입하지 않는다.
 */
export type ParagraphKey =
  | "overview"
  | "plan"
  | "extraCost"
  | "benefit"
  | "result"
  | "closing";

export const PARAGRAPH_KEYS: ParagraphKey[] = [
  "overview",
  "plan",
  "extraCost",
  "benefit",
  "result",
  "closing",
];

export interface Paragraph {
  type: "ai";
  key: ParagraphKey;
  text: string;
  /** "ai" | "fallback" | "user" — 화면 배지로 표시 */
  source: "ai" | "fallback" | "user" | "pending";
  editable: boolean;
  editedByUser: boolean;
}

export interface SubsidyDocument {
  meta: {
    form: string; // "별지 제3호"
    period: ReportPeriod;
    createdAt: string;
    paragraphCount: number;
    /** 추가비용이 발생하지 않아 보조금 신청 대상이 아닌 경우 */
    eligible: boolean;
    coefficientVersion: string;
  };
  sections: {
    applicant: { type: "computed" } & Applicant;
    plan: { type: "computed" } & PlanSection;
    extraCost: { type: "computed" } & ExtraCostSection;
    benefit: { type: "computed" } & BenefitSection;
    result: { type: "computed" } & ResultSection;
    attachments: { type: "computed"; items: string[] };
  };
  paragraphs: Record<ParagraphKey, Paragraph>;
}

/** K-ESG 지표표 (06c 두 번째 탭) */
export interface KesgIndicator {
  code: string; // "E-3-2"
  name: string;
  value: string;
  basis: string;
}

export interface KesgReport {
  meta: { period: ReportPeriod; area: string; createdAt: string };
  indicators: KesgIndicator[];
  narrative: Paragraph;
}
