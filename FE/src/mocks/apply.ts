/** 06a~06c 전환교통 보조금 사업계획서 */

export const applyMeta = {
  periodLabel: "2026년 2분기 실적 기준",
  title: "전환교통 보조금 사업계획서",
  legalBasis:
    "지속가능 교통물류 발전법 제21조 · 국토교통부 고시 제2019-16호 서식에 맞춰 작성됩니다.",
  disclaimer: "수치는 법정 산식으로 계산되며, AI는 서술 문장만 작성합니다.",
  generatedAt: "2026.08.12 14:32 · 6개 문단 작성됨",
};

export const breadcrumb = ["홈", "보조금 · ESG 리포트", "신청서 작성"];

/* ── 06a 생성 전 ─────────────────────────────────────── */

export interface ChecklistItem {
  title: string;
  desc: string;
  status: string;
  /** true면 AI 배지 */
  ai?: boolean;
}

export const checklist: ChecklistItem[] = [
  {
    title: "전환 계획",
    desc: "노선·품목·전환물량·수송횟수 표 자동 구성",
    status: "운송 실적 12건 연동됨",
  },
  {
    title: "추가비용 산출",
    desc: "철도수송비·상하역비·셔틀비에서 도로수송비 차감",
    status: "정산 데이터 준비 완료",
  },
  {
    title: "사회환경적 편익",
    desc: "탄소·대기오염·교통사고·도로혼잡 4개 항목 산정",
    status: "환경부 계수 2026 적용",
  },
  {
    title: "보조금 산정액",
    desc: "추가비용과 편익의 30% 중 작은 값으로 상한 산정",
    status: "고시 제2019-16호 산식",
  },
  {
    title: "서술 문단",
    desc: "산출된 수치를 근거로 사업 개요·기대효과 문장 작성",
    status: "생성 시 작성됩니다",
    ai: true,
  },
];

export const criteria: { label: string; value: string }[] = [
  { label: "대상 기간", value: "2026.04.01 ~ 06.30" },
  { label: "전환 운송 실적", value: "12건 · 4,280톤" },
  { label: "신청 주체", value: "embark(주)" },
  { label: "예상 소요", value: "약 10초" },
];

/* ── 06b 생성 중 ─────────────────────────────────────── */

/**
 * 06b 한 줄의 표시 모양.
 *
 * ⚠️ 예전엔 여기 `generateSteps` / `generateProgress` 고정 상수가 있었고 화면이
 *    그걸 그대로 그렸다. "6개 문단 중 4번째" 가 영원히 4번째에 멈춰 있는 가짜
 *    진행률이었다. 지금은 `app/subsidy/generating/page.tsx` 가 SSE
 *    (`/api/subsidy/applications/{id}/stream`)로 받은 실제 단계를 내려준다.
 *    **여기에 다시 고정값을 두지 말 것.**
 */
export interface GenerateStep {
  label: string;
  result: string;
  done: boolean;
  /** 진행 중인 AI 단계 */
  ai?: boolean;
}

/* ── 06c 완료 · 문서 ─────────────────────────────────── */

export const docHeader = {
  formNo: "[별지 제3호 서식]",
  title: "「전환교통 지원사업 사업계획서」",
  basis: "근거: 지속가능 교통물류 발전법 제21조 · 국토교통부 고시 제2019-16호",
  org: "접수기관: 한국철도물류협회 (국토교통부 위탁) · 작성일 2026. 08. 12.",
  sign: "2026년 8월 12일 · 신청인 embark 주식회사 대표이사 제예인 (인)",
};

export const applicant: { label: string; value: string; wide?: boolean }[] = [
  { label: "상호", value: "embark" },
  { label: "사업자등록번호", value: "111-11-11111" },
  { label: "대표자", value: "제예인" },
  { label: "담당자", value: "최현지 · 010-1111-1234" },
  { label: "소재지", value: "서울특별시 oorn oo동", wide: true },
];

export interface PlanRow {
  section: string;
  item: string;
  tons: string;
  trips: string;
  wagonType: string;
}

export const planRows: PlanRow[] = [
  {
    section: "울산 → 의왕ICD",
    item: "석유화학제품",
    tons: "1,860톤",
    trips: "5회",
    wagonType: "컨테이너",
  },
  {
    section: "광양 → 오봉",
    item: "화학원료",
    tons: "1,540톤",
    trips: "4회",
    wagonType: "유개화차",
  },
  {
    section: "포항 → 부곡",
    item: "철강재",
    tons: "880톤",
    trips: "3회",
    wagonType: "무개화차",
  },
];

export const planTotal: PlanRow = {
  section: "합계",
  item: "3개 품목",
  tons: "4,280톤",
  trips: "12회",
  wagonType: "3종",
};

export interface CostRow {
  label: string;
  formula: string;
  amount: string;
}

export const costRows: CostRow[] = [
  {
    label: "철도수송비",
    formula: "4,280t × 96,500원",
    amount: "413,020,000원",
  },
  { label: "상하역비", formula: "12회 × 4,850,000원", amount: "58,200,000원" },
  { label: "셔틀운송비", formula: "양단 42km × 12회", amount: "36,780,000원" },
  {
    label: "도로수송비 (차감)",
    formula: "기존 도로 운송 실적 기준",
    amount: "△93,000,000원",
  },
];

export const costTotal = {
  label: "추가비용 계 (A)",
  formula: "철도 + 상하역 + 셔틀 − 도로",
  amount: "415,000,000원",
};

export interface BenefitDocRow {
  label: string;
  basis: string;
  source: string;
  amount: string;
}

export const benefitDocRows: BenefitDocRow[] = [
  {
    label: "온실가스 감축",
    basis: "182 tCO₂eq",
    source: "환경부 배출계수",
    amount: "158,000,000원",
  },
  {
    label: "대기오염 저감",
    basis: "NOx·SOx·PM2.5",
    source: "환경부 사회적비용 단가",
    amount: "64,000,000원",
  },
  {
    label: "교통사고 예방",
    basis: "대형화물차 45대 감소",
    source: "KOTI 산식",
    amount: "53,000,000원",
  },
  {
    label: "도로혼잡 완화",
    basis: "차량·km 감소분",
    source: "KOTI 산식",
    amount: "865,000,000원",
  },
];

export const benefitDocTotal = "1,140,000,000원";

export const subsidyRows = [
  {
    label: "추가비용 (A)",
    formula: "3. 추가비용 산출 합계",
    amount: "415,000,000원",
  },
  {
    label: "편익 × 30% (B)",
    formula: "1,140,000,000 × 0.3",
    amount: "342,000,000원",
  },
];

export const subsidyResult = {
  label: "보조금 신청액",
  formula: "min(A, B) · 국토교통부 고시 제2019-16호",
  amount: "342,000,000원",
};

export const attachments = [
  "① 운송 실적 증빙 (코레일 화물운송 내역서 12건)",
  "② 도로 운송 실적 비교표 (전년 동기 기준)",
  "③ 사업자등록증 사본",
  "④ 배출량 산정 근거자료 (환경부 배출계수 적용표)",
];

/** AI가 쓴 서술 문단. id는 hover 상태 관리에 쓴다 */
export interface AiParagraph {
  id: string;
  body: string;
}

export const paragraphs: Record<
  "plan" | "benefit" | "closing" | "esg",
  AiParagraph
> = {
  plan: {
    id: "p1",
    body: "당사는 2026년 2분기 중 울산·광양·포항 3개 권역에서 발생한 소량 화물 12건(총 4,280톤)을 알뜰철도 X의 AI 합적 시스템으로 통합하여, 도로 단독 운송에서 철도 연계 복합운송으로 전환하였습니다. 단독으로는 1편성을 채우지 못하던 물량을 동일 노선 화주와 공동 편성함으로써 전 구간 평균 적재율 81%를 확보하였습니다.",
  },
  benefit: {
    id: "p2",
    body: "본 전환을 통해 보고 기간 내 182 tCO₂eq의 온실가스를 감축하였으며, 대기오염 저감과 교통사고 예방, 도로혼잡 완화를 포함한 사회환경적 편익은 총 1,140,000,000원으로 산출되었습니다. 이는 동일 물량을 도로로만 수송했을 경우 대비 74% 수준의 배출 저감에 해당하며, 감축분은 당사 지속가능경영보고서의 Scope 3 항목에 그대로 반영할 수 있습니다.",
  },
  closing: {
    id: "p3",
    body: "당사는 본 사업으로 확보한 전환 실적을 지속가능경영보고서 Scope 3 항목에 반영할 예정이며, 향후 3개년간 연간 전환물량을 20% 이상 확대하여 간선 물류의 철도 분담률을 지속적으로 높여 나가고자 합니다.",
  },
  esg: {
    id: "p4",
    body: "당사는 물류 부문의 Scope 3 배출량을 관리하기 위해 간선 운송의 철도 전환을 추진하였으며, 보고 기간 내 182 tCO₂eq를 감축하였습니다. 감축량과 대기오염물질 저감분은 환경부 배출계수와 사회적비용 단가를 적용해 산정하였고, 산식과 계수 출처를 함께 공개하여 검증 가능성을 확보하였습니다.",
  },
};

/* ── K-ESG 지표표 탭 ─────────────────────────────────── */

export const esgHeader = {
  formNo: "[공시 증빙용]",
  title: "「K-ESG 지표표」",
  meta: "대상 기간: 2026. 04. 01. ~ 06. 30. · 환경(E) 영역 · 작성일 2026. 08. 12.",
  org: "embark 주식회사 · 물류 부문 Scope 3",
  guideline:
    "공급망 실사 대응 K-ESG 가이드라인 (산업통상자원부 · 한국생산성본부) 기준으로 작성되었습니다.",
};

export interface EsgRow {
  code: string;
  name: string;
  value: string;
  source: string;
}

export const esgRows: EsgRow[] = [
  {
    code: "E-3-2",
    name: "온실가스 배출량 (Scope 3)",
    value: "182 tCO₂eq 감축",
    source: "환경부 배출계수 2026",
  },
  {
    code: "E-7-1",
    name: "대기오염물질 배출량",
    value: "NOx·SOx·PM2.5 저감 · 6,400만 원 상당",
    source: "환경부 사회적비용 단가",
  },
  {
    code: "E-3-3",
    name: "온실가스 배출량 검증",
    value: "산식·계수 출처 명시",
    source: "공공 데이터 기반",
  },
];

/* ── 우측 sticky 패널 ────────────────────────────────── */

export const panel = {
  a: { label: "추가비용 (A)", value: "4억 1,500만", adopted: false },
  b: { label: "편익 × 30% (B)", value: "3억 4,200만", adopted: true },
  resultLabel: "보조금 신청액 = min(A, B)",
  result: "3억 4,200만 원",
  resultKrw: "₩342,000,000",
  caution: "제출 전 5번 항목의 산정 결과를 관할 지자체 담당자와 확인하세요.",
};
