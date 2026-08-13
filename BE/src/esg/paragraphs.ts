/**
 * K-ESG 공시 리포트 문단 정의 (api_list #41).
 *
 * 문단 5개. 각각 대응하는 공시 기준이 있고, 인용해도 되는 수치가 정해져 있습니다.
 *
 * **폴백 템플릿이 본체입니다.** Claude 호출이 실패하든 네트워크가 끊기든 문서는
 * 반드시 나와야 합니다. 템플릿을 "대충 만든 예비"로 두면 시연 당일 와이파이가
 * 흔들릴 때 그대로 무너집니다. 템플릿만으로도 제출 가능한 수준을 유지하세요.
 */

import { CARBON_PRICE_IN_USE } from "../constants";
import { SCOPE3_CATEGORY } from "./indicators";
import type { EsgAggregate, EsgSectionKey } from "./types";

const fmt1 = (n: number) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

export interface ParagraphSpec {
  key: EsgSectionKey;
  title: string;
  standard: string;
  /** 이 문단이 다뤄야 할 내용 — 프롬프트에 그대로 들어갑니다 */
  brief: string;
  /** LLM 없이도 제출 가능한 문장 */
  fallback: (agg: EsgAggregate) => string;
}

/** 문단이 인용해도 되는 수치 묶음. 프롬프트 입력이자 환각 검출기의 허용 목록입니다. */
export function buildFacts(agg: EsgAggregate) {
  const subject = agg.shipperName ?? "당사 플랫폼 참여 화주 전체";
  // 지표표와 같은 출처를 씁니다. 여기서 다시 곱하면 리포트 문장과 지표표에
  // 서로 다른 금액이 실려 나갑니다.
  const ghgKrw = agg.benefitItems.find((b) => b.key === "ghg")?.amountKrw ?? 0;

  return {
    대상: subject,
    기간: `${agg.period.label} (${agg.period.from} ~ ${agg.period.to})`,
    수송실적: {
      편성횟수: agg.tripCount,
      활동데이터건수: agg.legCount,
      참여화주수: agg.shipperCount,
      총수송량톤: agg.totalTon,
      평균적재율: pct(agg.avgLoadRate),
      철도간선_tonkm: agg.volumes.railTonKm,
      셔틀_tonkm: agg.volumes.shuttleTonKm,
      도로기준선_tonkm: agg.volumes.roadDirectTonKm,
    },
    온실가스: {
      기준선배출량_tCO2eq: agg.baselineCo2Ton,
      실제배출량_tCO2eq: agg.actualCo2Ton,
      감축량_tCO2eq: agg.reducedCo2Ton,
      감축률: pct(agg.reductionRate),
      탄소단가_원당_tCO2eq: CARBON_PRICE_IN_USE,
      감축량_금전환산_원: ghgKrw,
    },
    // `물질` 을 값으로도 넣습니다. 환각 검출기는 객체의 **값만** 순회하므로
    // 라벨을 키로만 두면 "PM2.5" 의 2.5 가 등록되지 않고, 물질명을 언급한
    // 정상 문장이 전부 환각으로 잡혀 대기오염 문단이 매번 폴백으로 떨어집니다.
    // 필드명을 `감축량` 으로 두면 안 됩니다. 값이 음수(증가)일 때 모델이 이름만 보고
    // "0.55kg 감축"이라고 써버립니다. **이름 자체로 방향을 못 박습니다.**
    대기오염물질: Object.fromEntries(
      agg.pollutants.map((p) => [
        p.label,
        {
          물질: p.label,
          기준선_kg: p.baselineKg,
          실제_kg: p.actualKg,
          방향: p.reducedKg >= 0 ? "감소" : "증가",
          증감_kg: p.reducedKg,
          "증감_kg_설명": "양수면 감소, 음수면 증가입니다",
          증감폭_kg: Math.abs(p.reducedKg),
          증감률: pct(Math.abs(p.reductionRate)),
        },
      ]),
    ),
    사회환경적편익: {
      항목별_원: Object.fromEntries(agg.benefitItems.map((b) => [b.label, b.amountKrw])),
      합계_원: agg.totalBenefitKrw,
    },
    환산표현: { 소나무_그루: agg.pineTrees, 대형트럭_대: agg.truckLoadsAvoided },
    검증: {
      계수버전: agg.coefficientVersion,
      계수검증여부: agg.verified ? "1차 출처 확인 완료" : "미검증(추정치 포함)",
      제3자검증: "미실시 — 내부 산정치",
    },
  };
}

export const PARAGRAPHS: ParagraphSpec[] = [
  {
    key: "overview",
    title: "1. 물류 전환 개요",
    standard: "K-ESG E-1-1 (환경경영 목표) · GRI 305 서문",
    brief:
      "해당 기간에 도로 운송을 철도 합적으로 전환한 활동을 요약한다. " +
      "몇 회 편성했고 총 몇 톤을 옮겼는지, 적재율은 어땠는지를 담되 " +
      "자화자찬 대신 활동 사실 위주로 쓴다.",
    fallback: (a) =>
      `${a.shipperName ?? "당사"}는 ${a.period.label} 동안 도로 화물운송 물량을 철도 합적 수송으로 전환하였다. ` +
      `해당 기간 중 총 ${a.tripCount}회의 합적 편성을 통해 ${fmt1(a.totalTon)}톤을 수송하였으며, ` +
      `편성 평균 적재율은 ${pct(a.avgLoadRate)}이다. ` +
      `개별 화주 단위로는 화차 1량을 채우지 못해 철도 이용이 불가능한 소량 물량을 동일 노선 기준으로 통합하여 ` +
      `코레일 복귀 공차에 적재하는 방식으로, 총 ${a.legCount}건의 수송 실적을 확보하였다.`,
  },
  {
    key: "scope3",
    title: "2. Scope 3 온실가스 배출량 (Cat.4)",
    standard: "K-ESG E-3-2 · GRI 305-3 · ISSB IFRS S2",
    brief:
      "물류 전환에 따른 Scope 3 Category 4 배출량 변화를 서술한다. " +
      "기준선(도로 직행 가정)과 실제 배출량을 비교하고, 셔틀 구간 배출을 실제 배출량에 포함했다는 점을 밝힌다. " +
      "감축량을 '배출하지 않은 양'으로 정확히 표현하고 '흡수' 같은 표현은 쓰지 않는다.",
    fallback: (a) =>
      `본 전환에 따른 온실가스 배출량은 ${SCOPE3_CATEGORY} 에 해당한다. ` +
      `동일 물량을 전 구간 도로로 직행 운송하였을 경우의 기준선 배출량은 ${fmt1(a.baselineCo2Ton)} tCO₂eq이며, ` +
      `철도 간선 및 양단 셔틀 운송을 합산한 실제 배출량은 ${fmt1(a.actualCo2Ton)} tCO₂eq로 산정되었다. ` +
      `이에 따라 ${fmt1(a.reducedCo2Ton)} tCO₂eq, 기준선 대비 ${pct(a.reductionRate)}의 배출 감축 효과가 발생하였다. ` +
      `공장과 철도역을 연결하는 양단 셔틀 구간은 철도 전환 이후에도 도로 운송이 유지되므로 실제 배출량에 포함하여 산정하였다.`,
  },
  {
    key: "airQuality",
    // 제목에 "저감"을 박아두면 증가한 기간에도 제목이 결론을 미리 말해버립니다.
    title: "3. 대기오염물질 배출 증감",
    standard: "GRI 305-7 · K-ESG E-7-1 (참고 — 단위 상이)",
    brief:
      "NOx·SOx·PM2.5 의 증감을 서술한다. **증가한 물질이 있으면 반드시 증가했다고 쓴다.** " +
      "디젤 기관차에 후처리 장치가 없어 연료당 배출이 많고 철도 간선거리가 더 길다는 것이 원인이다. " +
      "온실가스 감축과 대기오염물질 증감은 별개라는 점을 분명히 하고, " +
      "수송 단계 배출이라 사업장 배출량과 합산하면 안 된다는 점도 짚는다. " +
      "증가를 '소폭'·'미미'처럼 완화하는 표현으로 덮지 않는다.",
    fallback: (a) => {
      // 지표표(E-7-1)와 같은 자릿수로 씁니다. SOx·PM2.5 는 1자리로 자르면 0.2kg 가 됩니다.
      const down = a.pollutants.filter((p) => p.reducedKg >= 0);
      const up = a.pollutants.filter((p) => p.reducedKg < 0);
      const list = (ps: typeof a.pollutants) =>
        ps.map((p) => `${p.label} ${fmt2(Math.abs(p.reducedKg))}kg`).join(", ");

      // 증가한 물질이 있으면 문장 구조 자체가 달라집니다.
      // "감소하였다"로 시작해놓고 증가분을 덧붙이면 읽는 사람이 결론을 반대로 가져갑니다.
      const head =
        up.length === 0
          ? `수송수단 전환에 따라 대기오염물질 배출량도 함께 감소하였다. 기준선 대비 저감량은 ${list(down)}이다.`
          : down.length === 0
            ? `수송수단 전환에 따른 대기오염물질 배출량은 기준선 대비 증가하였다. 증가량은 ${list(up)}이다.`
            : `수송수단 전환에 따른 대기오염물질 배출량은 물질별로 방향이 다르다. ` +
              `${list(down)}은 감소하였으나, ${list(up)}은 오히려 증가하였다.`;

      const cause =
        up.length === 0
          ? ""
          : `증가의 원인은 견인 방식과 경로 길이에 있다. 디젤 기관차는 대형 화물차와 달리 ` +
            `선택적촉매환원장치(SCR)와 매연저감장치(DPF)를 갖추지 않아 연료 1리터당 ` +
            `질소산화물과 입자상물질 배출이 많으며, 철도 간선거리가 도로 직행거리보다 길어 ` +
            `연료 효율에서 얻은 이득이 상쇄된다. 온실가스 감축 효과와 대기오염물질 증감은 별개로 판단하여야 한다. `;

      return (
        `${head} ${cause}` +
        `본 수치는 사업장 고정오염원 배출이 아닌 수송 단계에서 발생하는 이동오염원 배출량으로, ` +
        `사업장 배출량과 별도로 관리한다. ` +
        `연료 연소에 따른 배기 배출만 산정하였으며, 타이어·제동장치·노면 마모에 의한 비배기 배출은 ` +
        `도로와 철도 양측 모두 제외하였다.`
      );
    },
  },
  {
    key: "verification",
    title: "4. 산정 근거 및 검증",
    standard: "K-ESG E-3-3 · ISO 14064-3",
    brief:
      "산정 방법과 검증 상태를 밝힌다. 제3자 검증을 받지 않았다면 그 사실을 분명히 쓴다. " +
      "대신 활동데이터 추적성과 계수 출처 고정으로 재현 가능하다는 점을 근거로 제시한다. " +
      "검증받은 것처럼 읽히는 문장은 절대 쓰지 않는다.",
    fallback: (a) =>
      `본 배출량은 수송 실적 원장의 활동데이터 ${a.legCount}건에 수송수단별 배출원단위를 적용하여 산정한 내부 산정치이며, ` +
      `제3자 검증기관의 검증을 받지 않았다. ` +
      `산정에 적용한 계수는 버전 ${a.coefficientVersion}으로 고정되어 있고 출처가 항목별로 명시되어 있으며, ` +
      `활동데이터는 수송 일자·화주·노선·중량 단위로 원자료 내보내기가 가능하다. ` +
      `따라서 외부 검증기관이 동일한 계수와 활동데이터로 본 산정 결과를 재현할 수 있다. ` +
      `${a.verified ? "" : "일부 계수는 1차 출처 확인이 완료되지 않은 추정치이며, 확정 시 소급 재산정한다."}`,
  },
  {
    key: "outlook",
    title: "5. 향후 계획",
    standard: "K-ESG E-1-1 (환경경영 목표 수립)",
    brief:
      "다음 기간 계획을 서술한다. 달성하지 않은 목표를 확정된 것처럼 쓰지 않는다. " +
      "구체적 감축 목표 수치를 지어내면 안 되고, 방향만 제시한다.",
    fallback: (a) =>
      `당사는 대상 노선과 참여 화주를 확대하여 철도 전환 물량을 지속적으로 늘려나갈 계획이다. ` +
      `${a.period.label} 기준 편성 평균 적재율은 ${pct(a.avgLoadRate)}로, ` +
      `공차 구간에 적재 가능한 여유가 남아 있어 추가 물량 확보 시 동일 편성 내에서 감축량을 늘릴 수 있다. ` +
      `또한 적용 계수의 1차 출처 확인과 제3자 검증 절차를 순차적으로 진행하여 공시 신뢰성을 높이고, ` +
      `산정 결과는 분기 단위로 갱신하여 Scope 3 공시 자료로 활용한다.`,
  },
];

export const SECTION_KEYS = PARAGRAPHS.map((p) => p.key);

export function isSectionKey(value: string): value is EsgSectionKey {
  return (SECTION_KEYS as string[]).includes(value);
}
