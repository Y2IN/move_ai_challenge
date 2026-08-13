/**
 * 서술 문단 6개의 정의 · 프롬프트 · 폴백 템플릿.
 *
 * **LLM은 문장만 쓴다. 숫자는 전부 계산에서 온다.**
 * 각 문단에는 인용해도 되는 수치만 골라서 넣는다. 문서 전체를 통째로 넣으면
 * 관계없는 숫자를 끌어다 쓸 확률이 올라간다.
 *
 * `eligible` 이 false 면 논조가 정반대가 된다.
 * (보조금 신청 → 신청 대상 아님 + 공시 자산 활용) — docs/ESG_REPORT_PLAN.md §4.3
 */

import type { ParagraphKey, ReportInput } from "./contract";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

export const SYSTEM_PROMPT = `너는 「전환교통 지원사업 사업계획서」(별지 제3호 서식)의 서술 문단을 작성한다.
이 문서는 관할 지자체에 실제로 제출되는 법정 서식이다.

절대 규칙:
1. **[산출 수치]에 주어지지 않은 숫자를 절대 쓰지 마라.** 새로 계산하지도, 다른 단위로 환산하지도, 반올림해서 바꾸지도 마라.
2. 수치를 인용할 때는 주어진 표기를 **글자 그대로** 옮겨라.
3. 숫자가 꼭 필요한 게 아니면 넣지 마라. 억지로 채우지 마라.
4. 공문서 문체를 쓴다. "당사는 ~하였습니다" 체. 과장·마케팅 표현 금지.
5. 문단 본문만 출력한다. 제목·번호·머리말·따옴표·설명을 붙이지 마라.`;

export interface ParagraphSpec {
  key: ParagraphKey;
  /** 서식에서의 위치 — 화면 표시용 */
  location: string;
  sentences: [number, number];
  /** 이 문단이 인용해도 되는 수치 */
  facts: (input: ReportInput) => string[];
  /** 무엇을 쓸지 */
  instruction: (input: ReportInput) => string;
  /** 생성 AI 호출 실패 시 쓰는 규칙기반 문장 */
  fallback: (input: ReportInput) => string;
}

export const PARAGRAPH_SPECS: Record<ParagraphKey, ParagraphSpec> = {
  overview: {
    key: "overview",
    location: "사업 개요",
    sentences: [2, 3],
    facts: (i) => [
      `대상 기간: ${i.period.label} (${i.period.from} ~ ${i.period.to})`,
      `신청 주체: ${i.applicant.name}`,
      `전환 물량: ${i.plan.total.tons}톤`,
      `수송 횟수: ${i.plan.total.trips}회`,
      `품목 수: ${i.plan.total.itemCount}개`,
    ],
    instruction: () =>
      "본 사업의 개요를 서술하라. 대상 기간, 신청 주체, 전환 물량 규모를 담되 세부 내역은 다음 항목에서 다루므로 반복하지 마라.",
    fallback: (i) =>
      `당사는 ${i.period.label}(${i.period.from} ~ ${i.period.to}) 중 발생한 화물 ${i.plan.total.tons}톤을 도로 운송에서 철도 연계 복합운송으로 전환하였으며, 그 실적을 근거로 본 사업계획서를 제출합니다.`,
  },

  plan: {
    key: "plan",
    location: "2. 전환 계획 뒤",
    sentences: [2, 4],
    facts: (i) => [
      ...i.plan.rows.map(
        (r) => `${r.route} · ${r.item} · ${r.tons}톤 · ${r.trips}회 · ${r.wagonType}`,
      ),
      `합계: ${i.plan.total.tons}톤 / ${i.plan.total.trips}회 / ${i.plan.total.itemCount}개 품목`,
      `평균 적재율: ${pct(i.plan.avgLoadRate)}`,
    ],
    instruction: () =>
      "전환 계획을 서술하라. **AI 합적으로 소량 화물을 공동 편성해 적재율을 확보했다**는 점을 반드시 담아라. 단독으로는 화차 1편성을 채우지 못하던 물량이라는 맥락을 넣어라.",
    fallback: (i) =>
      `당사는 ${i.period.label} 중 단독으로는 화차 1편성을 채우지 못하는 소량 화물을 동일 노선 화주와 공동 편성하여, 총 ${i.plan.total.tons}톤을 ${i.plan.total.trips}회에 걸쳐 철도로 전환하였습니다. 이를 통해 평균 적재율 ${pct(i.plan.avgLoadRate)}를 확보하였습니다.`,
  },

  extraCost: {
    key: "extraCost",
    location: "3. 추가비용 산출 뒤",
    sentences: [2, 3],
    facts: (i) => [
      ...i.extraCost.rows.map((r) => `${r.label}: ${won(Math.abs(r.amount))}`),
      `추가비용 합계(A): ${won(Math.abs(i.extraCost.totalA))}${i.extraCost.totalA < 0 ? " (도로 대비 절감)" : ""}`,
    ],
    instruction: (i) =>
      i.result.eligible
        ? "철도 전환에 따른 추가비용의 구성을 서술하라. 철도수송비·상하역비·셔틀운송비에서 기존 도로수송비를 차감한 구조임을 설명하라."
        : "비용 구조를 서술하라. **철도 합적 비용이 기존 도로 운송비보다 낮아 전환 추가비용이 발생하지 않았다**는 점을 명확히 하라. 이는 합적을 통해 화차 최저톤수를 분담한 결과다.",
    fallback: (i) =>
      i.result.eligible
        ? `철도 전환에 따른 추가비용은 철도수송비와 상하역비, 양단 셔틀운송비의 합계에서 기존 도로수송비를 차감하여 산출하였으며, 그 규모는 ${won(i.extraCost.totalA)}입니다.`
        : `합적을 통해 화차 최저톤수를 다수 화주가 분담한 결과, 철도 연계 운송 비용이 기존 도로 운송비보다 낮게 산출되었습니다. 따라서 본 전환에서는 지원 대상이 되는 전환 추가비용이 발생하지 않았습니다.`,
  },

  benefit: {
    key: "benefit",
    location: "4. 사회환경적 편익 뒤",
    sentences: [3, 4],
    facts: (i) => [
      `온실가스 감축량: ${i.benefit.co2ReducedTon} tCO₂eq`,
      `감축률: ${pct(i.benefit.co2ReductionRate)}`,
      ...i.benefit.items.map((it) => `${it.label}: ${won(it.amount)} (근거 ${it.basis})`),
      `편익 합계(B): ${won(i.benefit.totalB)}`,
      `계수 출처: ${[...new Set(i.benefit.items.map((it) => it.source))].join(" / ")}`,
    ],
    instruction: () =>
      "사회환경적 편익을 서술하라. 온실가스 감축량과 편익 합계를 담고, **감축분을 지속가능경영보고서 Scope 3 항목에 반영할 수 있다**는 점으로 맺어라. 계수 출처를 언급해 검증 가능성을 드러내라.",
    fallback: (i) =>
      `본 전환을 통해 보고 기간 내 ${i.benefit.co2ReducedTon} tCO₂eq의 온실가스를 감축하였으며, 대기오염 저감과 교통사고 예방, 도로혼잡 완화를 포함한 사회환경적 편익은 총 ${won(i.benefit.totalB)}으로 산출되었습니다. 이는 동일 물량을 도로로만 수송했을 경우 대비 ${pct(i.benefit.co2ReductionRate)} 수준의 배출 저감에 해당하며, 감축분은 당사 지속가능경영보고서의 Scope 3 항목에 반영할 수 있습니다.`,
  },

  result: {
    key: "result",
    location: "5. 보조금 산정 결과 뒤",
    sentences: [2, 3],
    facts: (i) => [
      `추가비용(A): ${won(Math.abs(i.result.A))}${i.result.A < 0 ? " (음수 — 추가비용 미발생)" : ""}`,
      `편익 상한(B): ${won(i.result.B)}`,
      `채택: ${i.result.adopted}`,
      `보조금 신청액: ${won(i.result.subsidy)}`,
      `근거: ${i.result.legalBasis}`,
    ],
    instruction: (i) =>
      i.result.eligible
        ? "보조금 산정 결과를 서술하라. 추가비용(A)과 편익 상한(B) 중 작은 값을 신청액으로 삼았음을 근거 규정과 함께 밝혀라."
        : "산정 결과를 서술하라. **전환 추가비용이 발생하지 않아 보조금 신청 대상이 아니라는 점**을 명확히 하고, 산출된 편익은 보조금이 아니라 공시 자산으로 활용한다는 점을 밝혀라. 보조금을 신청한다고 쓰지 마라.",
    fallback: (i) =>
      i.result.eligible
        ? `보조금 신청액은 전환 추가비용과 사회환경적 편익의 일정 비율 중 작은 값으로 산정하였으며, 그 결과 ${won(i.result.subsidy)}을 신청합니다. 산정 근거는 ${i.result.legalBasis}입니다.`
        : `본 전환에서는 철도 연계 운송 비용이 기존 도로 운송비보다 낮아 전환 추가비용이 발생하지 않았으며, 이에 따라 보조금 신청 대상에 해당하지 않습니다. 산출된 사회환경적 편익은 당사의 온실가스 공시 자료로 활용할 예정입니다.`,
  },

  closing: {
    key: "closing",
    location: "6. 기대효과 · 맺음",
    sentences: [2, 3],
    facts: (i) => [
      `전환 물량: ${i.plan.total.tons}톤`,
      `수송 횟수: ${i.plan.total.trips}회`,
      `온실가스 감축량: ${i.benefit.co2ReducedTon} tCO₂eq`,
    ],
    instruction: () =>
      "향후 계획으로 맺어라. 전환 실적을 지속가능경영보고서 Scope 3 항목에 반영할 예정이며 간선 물류의 철도 분담률을 지속적으로 높이겠다는 취지를 담아라. 구체적인 목표 수치를 지어내지 마라.",
    fallback: (i) =>
      `당사는 본 사업으로 확보한 전환 실적 ${i.plan.total.tons}톤을 지속가능경영보고서 Scope 3 항목에 반영할 예정이며, 향후 간선 물류의 철도 분담률을 지속적으로 높여 나가고자 합니다.`,
  },
};

/** 문단 하나에 대한 사용자 프롬프트를 만든다. */
export function buildPrompt(key: ParagraphKey, input: ReportInput): string {
  const spec = PARAGRAPH_SPECS[key];
  const [min, max] = spec.sentences;

  return [
    `[문단 위치] ${spec.location}`,
    `[분량] ${min}~${max}문장`,
    "",
    "[산출 수치] — 아래 값만 인용할 수 있다. 여기 없는 숫자는 쓰지 마라.",
    ...spec.facts(input).map((f) => `  - ${f}`),
    "",
    "[작성 지시]",
    spec.instruction(input),
  ].join("\n");
}
