/**
 * 06a~06c 전환교통 보조금 사업계획서의 **카피**.
 *
 * 수치(기간·실적 건수·톤수·계수 버전)는 #40 `/api/esg/indicators` 에서 옵니다.
 * 여기 남은 건 법적 근거 문구처럼 API 가 주지 않는 문장뿐입니다.
 */

export const applyMeta = {
  title: "전환교통 보조금 사업계획서",
  legalBasis:
    "지속가능 교통물류 발전법 제21조 · 국토교통부 고시 제2019-16호 서식에 맞춰 작성됩니다.",
  disclaimer: "수치는 법정 산식으로 계산되며, AI는 서술 문장만 작성합니다.",
};

export const breadcrumb = ["홈", "보조금 · ESG 리포트", "신청서 작성"];

/* ── 06a 생성 전 ─────────────────────────────────────── */

export interface ChecklistItem {
  title: string;
  desc: string;
  /** API 가 주지 않는 항목의 고정 문구 */
  status: string;
  /**
   * 이 값이 있으면 status 대신 #40 집계에서 채웁니다.
   *   trips        운송 실적 N건 연동됨
   *   coefficient  적용 계수 버전
   */
  statusFrom?: "trips" | "coefficient";
  /** true면 AI 배지 */
  ai?: boolean;
}

export const checklist: ChecklistItem[] = [
  {
    title: "전환 계획",
    desc: "노선·품목·전환물량·수송횟수 표 자동 구성",
    status: "운송 실적 집계 대기",
    statusFrom: "trips",
  },
  {
    title: "추가비용 산출",
    desc: "철도수송비·상하역비·셔틀비에서 도로수송비 차감",
    status: "정산 데이터 준비 완료",
  },
  {
    title: "사회환경적 편익",
    desc: "탄소·대기오염·교통사고·도로혼잡 4개 항목 산정",
    status: "계수 확인 중",
    statusFrom: "coefficient",
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

/*
 * 06c(완료 · 문서)의 서식 목업은 전부 지웠습니다 — 신청인·전환 계획표·추가비용·
 * 편익·보조금 산정은 #31~#39 가 만든 문서를 `lib/subsidy-view.ts` 가 그립니다.
 */
