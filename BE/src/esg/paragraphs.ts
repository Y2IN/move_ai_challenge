/**
 * K-ESG 공시 리포트 문단 정의 (api_list #41).
 *
 * 문단 5개. 각각 대응하는 공시 기준이 있고, 인용해도 되는 수치가 정해져 있습니다.
 *
 * **폴백 초안이 본체입니다.** 생성 AI 호출이 실패하든 네트워크가 끊기든 문서는
 * 반드시 나와야 합니다. 폴백을 "대충 만든 예비"로 두면 시연 당일 와이파이가
 * 흔들릴 때 그대로 무너집니다. 폴백만으로도 제출 가능한 수준을 유지하세요.
 *
 * **문단마다 초안을 여러 벌 둡니다.** 한 벌만 두면 폴백 상태에서 '문단 재생성'을
 * 눌러도 같은 문장이 다시 나와, 보는 사람에게는 버튼이 고장난 것으로 읽힙니다.
 * 초안은 서로 다른 서술이되 **같은 사실**을 말해야 합니다 — 문장이 바뀐다고
 * 수치나 결론이 바뀌면 그건 공시 문서가 아닙니다.
 */

import { CARBON_PRICE_IN_USE } from "../constants";
import { SCOPE3_CATEGORY } from "./indicators";
import type { EsgAggregate, EsgSectionKey } from "./types";

const fmt1 = (n: number) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("ko-KR");
const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

export interface ParagraphSpec {
  key: EsgSectionKey;
  title: string;
  standard: string;
  /** 이 문단이 다뤄야 할 내용 — 프롬프트에 그대로 들어갑니다 */
  brief: string;
  /**
   * LLM 없이도 제출 가능한 초안들. 재생성할 때마다 다른 벌을 씁니다.
   *
   * 전부 같은 수치·같은 결론을 말해야 합니다. 서술 순서와 강조점만 다릅니다.
   */
  fallbacks: ReadonlyArray<(agg: EsgAggregate) => string>;
}

/**
 * 폴백 초안 하나를 고릅니다.
 *
 * `variant` 는 회전 인덱스입니다. 범위를 넘거나 음수여도 항상 유효한 초안이
 * 나오도록 감쌉니다 — 호출자가 단순 증가 카운터를 그대로 넘길 수 있게 하기 위함입니다.
 */
export function fallbackText(spec: ParagraphSpec, agg: EsgAggregate, variant = 0): string {
  const list = spec.fallbacks;
  const index = ((Math.trunc(variant) % list.length) + list.length) % list.length;
  return list[index](agg);
}

/** 대기오염물질을 증감 방향으로 가릅니다. 방향이 바뀌면 문장 구조 자체가 바뀝니다. */
function splitPollutants(a: EsgAggregate) {
  const down = a.pollutants.filter((p) => p.reducedKg >= 0);
  const up = a.pollutants.filter((p) => p.reducedKg < 0);
  /** "NOx 4.43kg, SOx 0.03kg" — 지표표(E-7-1)와 같은 자릿수(2자리)를 씁니다. */
  const list = (ps: EsgAggregate["pollutants"]) =>
    ps.map((p) => `${p.label} ${fmt2(Math.abs(p.reducedKg))}kg`).join(", ");
  return { down, up, list };
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
    fallbacks: [
      (a) =>
        `${a.shipperName ?? "당사"}는 ${a.period.label} 동안 도로 화물운송 물량을 철도 합적 수송으로 전환하였다. ` +
        `해당 기간 중 총 ${a.tripCount}회의 합적 편성을 통해 ${fmt1(a.totalTon)}톤을 수송하였으며, ` +
        `편성 평균 적재율은 ${pct(a.avgLoadRate)}이다. ` +
        `개별 화주 단위로는 화차 1량을 채우지 못해 철도 이용이 불가능한 소량 물량을 동일 노선 기준으로 통합하여 ` +
        `코레일 복귀 공차에 적재하는 방식으로, 총 ${a.legCount}건의 수송 실적을 확보하였다.`,

      (a) =>
        `${a.period.label} 중 ${a.shipperName ?? "당사"}는 개별 화주 단위로는 화차 1량을 채우지 못하는 소량 화물 ` +
        `${a.legCount}건을 동일 노선 기준으로 통합하여 철도 합적 수송을 실시하였다. ` +
        `참여 화주는 ${a.shipperCount}개사이며, 총 ${a.tripCount}회 편성으로 ${fmt1(a.totalTon)}톤을 수송하였다. ` +
        `합적 편성의 평균 적재율은 ${pct(a.avgLoadRate)}로, 코레일 복귀 공차를 활용하여 기존 도로 운송 물량을 철도로 이전하였다. ` +
        `본 활동은 환경경영 목표 중 수송 부문 배출 저감 과제에 대응한다.`,

      (a) =>
        `${a.shipperName ?? "당사"}는 ${a.period.label}(${a.period.from} ~ ${a.period.to}) 동안 도로 직행으로 운송되던 화물을 ` +
        `철도 간선과 양단 셔틀을 결합한 복합운송으로 전환하였다. ` +
        `전환 물량의 수송 활동량은 철도 간선 ${fmtInt(a.volumes.railTonKm)} 톤·km, ` +
        `양단 셔틀 ${fmtInt(a.volumes.shuttleTonKm)} 톤·km이며, 동일 물량을 도로로 직행 운송하였을 경우의 활동량은 ` +
        `${fmtInt(a.volumes.roadDirectTonKm)} 톤·km이다. ` +
        `해당 기간의 편성은 ${a.tripCount}회, 산정 근거가 되는 활동데이터는 ${a.legCount}건이며, ` +
        `편성 평균 적재율은 ${pct(a.avgLoadRate)}이다.`,
    ],
  },
  {
    key: "scope3",
    title: "2. Scope 3 온실가스 배출량 (Cat.4)",
    standard: "K-ESG E-3-2 · GRI 305-3 · ISSB IFRS S2",
    brief:
      "물류 전환에 따른 Scope 3 Category 4 배출량 변화를 서술한다. " +
      "기준선(도로 직행 가정)과 실제 배출량을 비교하고, 셔틀 구간 배출을 실제 배출량에 포함했다는 점을 밝힌다. " +
      "감축량을 '배출하지 않은 양'으로 정확히 표현하고 '흡수' 같은 표현은 쓰지 않는다.",
    fallbacks: [
      (a) =>
        `본 전환에 따른 온실가스 배출량은 ${SCOPE3_CATEGORY} 에 해당한다. ` +
        `동일 물량을 전 구간 도로로 직행 운송하였을 경우의 기준선 배출량은 ${fmt1(a.baselineCo2Ton)} tCO₂eq이며, ` +
        `철도 간선 및 양단 셔틀 운송을 합산한 실제 배출량은 ${fmt1(a.actualCo2Ton)} tCO₂eq로 산정되었다. ` +
        `이에 따라 ${fmt1(a.reducedCo2Ton)} tCO₂eq, 기준선 대비 ${pct(a.reductionRate)}의 배출 감축 효과가 발생하였다. ` +
        `공장과 철도역을 연결하는 양단 셔틀 구간은 철도 전환 이후에도 도로 운송이 유지되므로 실제 배출량에 포함하여 산정하였다.`,

      (a) =>
        `Scope 3 배출량은 ${SCOPE3_CATEGORY} 로 분류하여 산정하였다. ` +
        `산정 대상은 도로 직행을 가정한 기준선과 철도 전환 후 실제 수송이며, ` +
        `기준선 배출량 ${fmt1(a.baselineCo2Ton)} tCO₂eq에 대하여 실제 배출량은 ${fmt1(a.actualCo2Ton)} tCO₂eq이다. ` +
        `차이인 ${fmt1(a.reducedCo2Ton)} tCO₂eq은 흡수하거나 상쇄한 양이 아니라 수송수단 전환으로 배출하지 않은 양이며, ` +
        `기준선 대비 ${pct(a.reductionRate)}에 해당한다. ` +
        `양단 셔틀 구간에서 발생하는 도로 운송 배출은 감축 효과를 과대 계상하지 않도록 실제 배출량에 합산하였다.`,

      (a) =>
        `동일 물량을 도로로 직행 운송하였을 경우 ${fmt1(a.baselineCo2Ton)} tCO₂eq이 배출되나, ` +
        `철도 합적 전환 이후 실제 배출량은 ${fmt1(a.actualCo2Ton)} tCO₂eq으로 산정되었다. ` +
        `기준선 대비 감축률은 ${pct(a.reductionRate)}이며, 감축량 ${fmt1(a.reducedCo2Ton)} tCO₂eq은 ` +
        `소나무 ${fmtInt(a.pineTrees)}그루가 1년 동안 흡수하는 양에 상당한다. ` +
        `다만 환산 표현은 이해를 돕기 위한 것이며 배출권이나 상쇄 실적이 아니다. ` +
        `본 배출량은 ${SCOPE3_CATEGORY} 항목으로 공시하고, 철도역과 공장을 연결하는 양단 셔틀 구간은 ` +
        `전환 이후에도 도로 운송이 유지되므로 실제 배출량에 포함하였다.`,
    ],
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
    // 초안 3벌 모두 **증가한 물질이 있으면 증가라고 먼저 말합니다.**
    // 다른 초안 하나가 완곡해지면 재생성 버튼이 "듣기 좋은 문장 뽑기"가 됩니다.
    // 그 순간 이 문단은 공시 문서가 아니라 홍보물이 됩니다.
    fallbacks: [
      (a) => {
        const { down, up, list } = splitPollutants(a);

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

      (a) => {
        const { down, up, list } = splitPollutants(a);

        const head =
          up.length === 0
            ? `대기오염물질은 기준선 대비 전 물질이 감소하였다. 저감량은 ${list(down)}이다.`
            : down.length === 0
              ? `대기오염물질은 기준선 대비 전 물질이 증가하였다. 증가량은 ${list(up)}이다.`
              : `대기오염물질은 물질별 증감 방향이 엇갈렸다. ` +
                `기준선 대비 ${list(down)}이 감소한 반면 ${list(up)}은 증가하였다.`;

        const cause =
          up.length === 0
            ? ""
            : `증가는 견인 방식의 차이에서 비롯된다. 디젤 기관차에는 대형 화물차에 장착되는 ` +
              `선택적촉매환원장치(SCR)와 매연저감장치(DPF)가 없어 연료 단위당 질소산화물·입자상물질 배출이 높고, ` +
              `철도 간선거리가 도로 직행거리보다 길어 연료 효율에서 확보한 이득이 일부 상쇄되기 때문이다. ` +
              `따라서 온실가스 감축 실적을 대기오염물질 저감 실적으로 확대 해석하여서는 안 된다. `;

        return (
          `${head} ${cause}` +
          `본 항목은 수송 단계에서 발생하는 이동오염원 배출량이므로 사업장 고정오염원 배출량과 합산하지 않는다. ` +
          `산정 범위는 연료 연소에 따른 배기 배출이며, 타이어·제동장치·노면 마모에 의한 비배기 배출은 ` +
          `도로와 철도 모두에서 제외하였다.`
        );
      },

      (a) => {
        const { down, up, list } = splitPollutants(a);

        const head =
          up.length === 0
            ? `기준선 대비 증감을 물질별로 산정한 결과, ${list(down)}이 모두 감소하였다.`
            : down.length === 0
              ? `기준선 대비 증감을 물질별로 산정한 결과, ${list(up)}이 모두 증가하였다.`
              : `기준선 대비 증감을 물질별로 산정한 결과, ${list(down)}은 감소하였고 ${list(up)}은 증가하였다.`;

        const cause =
          up.length === 0
            ? ""
            : `증가한 물질은 완화 표현 없이 증가 사실을 그대로 기재한다. ` +
              `원인은 디젤 기관차에 매연저감장치(DPF)와 선택적촉매환원장치(SCR)가 장착되지 않아 ` +
              `연료 1리터당 입자상물질 배출이 도로 화물차보다 많다는 점, 그리고 철도 간선거리가 ` +
              `도로 직행거리보다 길다는 점에 있다. `;

        return (
          `${head} ${cause}` +
          `온실가스 감축 실적과 대기오염물질 증감은 서로 다른 지표이므로 분리하여 판단하여야 한다. ` +
          `산정 범위는 수송 단계 이동오염원의 배기 배출로, 사업장 고정오염원 배출과 ` +
          `타이어·제동장치·노면 마모에 의한 비배기 배출은 포함하지 않는다.`
        );
      },
    ],
  },
  {
    key: "verification",
    title: "4. 산정 근거 및 검증",
    standard: "K-ESG E-3-3 · ISO 14064-3",
    brief:
      "산정 방법과 검증 상태를 밝힌다. 제3자 검증을 받지 않았다면 그 사실을 분명히 쓴다. " +
      "대신 활동데이터 추적성과 계수 출처 고정으로 재현 가능하다는 점을 근거로 제시한다. " +
      "검증받은 것처럼 읽히는 문장은 절대 쓰지 않는다.",
    fallbacks: [
      (a) =>
        `본 배출량은 수송 실적 원장의 활동데이터 ${a.legCount}건에 수송수단별 배출원단위를 적용하여 산정한 내부 산정치이며, ` +
        `제3자 검증기관의 검증을 받지 않았다. ` +
        `산정에 적용한 계수는 버전 ${a.coefficientVersion}으로 고정되어 있고 출처가 항목별로 명시되어 있으며, ` +
        `활동데이터는 수송 일자·화주·노선·중량 단위로 원자료 내보내기가 가능하다. ` +
        `따라서 외부 검증기관이 동일한 계수와 활동데이터로 본 산정 결과를 재현할 수 있다. ` +
        `${a.verified ? "" : "일부 계수는 1차 출처 확인이 완료되지 않은 추정치이며, 확정 시 소급 재산정한다."}`,

      (a) =>
        `본 산정 결과는 제3자 검증을 받지 않은 내부 산정치이며, 이 사실을 공시 문서에 그대로 명시한다. ` +
        `배출량은 수송 실적 원장의 활동데이터 ${a.legCount}건 각각에 수송수단별 배출원단위를 적용하여 산출하였고, ` +
        `적용 계수는 버전 ${a.coefficientVersion}으로 고정되어 항목마다 출처를 밝히고 있다. ` +
        `활동데이터는 수송 일자·화주·노선·중량 단위로 원자료 내보내기가 가능하므로, ` +
        `외부 검증기관이 동일한 계수와 활동데이터로 산정 과정을 그대로 재현할 수 있다. ` +
        `${a.verified ? "계수는 1차 출처 확인이 완료된 상태이다." : "다만 일부 계수는 1차 출처 확인이 완료되지 않은 추정치이며, 출처 확정 시 소급 재산정한다."}`,

      (a) =>
        `산정 경계는 도로 직행을 가정한 기준선과 철도 전환 후 실제 수송으로 한정하였으며, ` +
        `양단 셔틀 구간을 실제 배출량에 포함하여 전환 효과를 과대 계상하지 않았다. ` +
        `활동데이터 ${a.legCount}건은 편성별 수송 실적 원장에서 직접 산출되고, 적용 계수는 버전 ${a.coefficientVersion}으로 고정되어 있어 ` +
        `동일 입력에 대해 동일한 결과가 재현된다. ` +
        `본 결과는 ISO 14064-3 에 따른 제3자 검증을 받지 않은 내부 산정치이므로 검증받은 실적으로 인용하여서는 안 된다. ` +
        `${a.verified ? "적용 계수는 1차 출처 확인이 완료되었다." : "적용 계수 일부는 1차 출처 확인 전 추정치를 포함하고 있으며, 확정 시 소급 재산정한다."}`,
    ],
  },
  {
    key: "outlook",
    title: "5. 향후 계획",
    standard: "K-ESG E-1-1 (환경경영 목표 수립)",
    brief:
      "다음 기간 계획을 서술한다. 달성하지 않은 목표를 확정된 것처럼 쓰지 않는다. " +
      "구체적 감축 목표 수치를 지어내면 안 되고, 방향만 제시한다.",
    fallbacks: [
      (a) =>
        `당사는 대상 노선과 참여 화주를 확대하여 철도 전환 물량을 지속적으로 늘려나갈 계획이다. ` +
        `${a.period.label} 기준 편성 평균 적재율은 ${pct(a.avgLoadRate)}로, ` +
        `공차 구간에 적재 가능한 여유가 남아 있어 추가 물량 확보 시 동일 편성 내에서 감축량을 늘릴 수 있다. ` +
        `또한 적용 계수의 1차 출처 확인과 제3자 검증 절차를 순차적으로 진행하여 공시 신뢰성을 높이고, ` +
        `산정 결과는 분기 단위로 갱신하여 Scope 3 공시 자료로 활용한다.`,

      (a) => {
        const { up } = splitPollutants(a);
        return (
          `다음 기간에는 대상 노선과 참여 화주를 확대하여 철도 전환 물량을 늘리는 것을 목표로 한다. ` +
          `${a.period.label} 편성 평균 적재율이 ${pct(a.avgLoadRate)}인 점을 고려하면 동일 편성 내에 잔여 적재 공간이 남아 있어, ` +
          `추가 물량을 유치할 경우 편성을 늘리지 않고도 감축량을 확대할 수 있다. ` +
          `구체적 감축 목표치는 대상 노선 확정 이후 산정할 예정이며, 현 시점에서 확정된 목표 수치는 없다. ` +
          `${up.length > 0 ? "증가한 대기오염물질 항목에 대해서는 저감 방안을 별도 과제로 검토한다." : "대기오염물질 증감은 계수 갱신 시마다 재산정하여 확인한다."}`
        );
      },

      () =>
        `향후 계획은 두 갈래로 진행한다. ` +
        `첫째, 적용 계수의 1차 출처 확인과 제3자 검증 절차를 순차적으로 진행하여 공시 신뢰성을 확보한다. ` +
        `둘째, 산정 결과를 분기 단위로 갱신하고 활동데이터 원자료를 함께 보관하여 외부 검증 요청에 대응한다. ` +
        `참여 화주와 대상 노선 확대는 계속 추진하되, 아직 달성하지 않은 감축 목표를 실적으로 표기하지 않는다. ` +
        `산정 결과는 Scope 3 공시 자료로 활용한다.`,
    ],
  },
];

export const SECTION_KEYS = PARAGRAPHS.map((p) => p.key);

export function isSectionKey(value: string): value is EsgSectionKey {
  return (SECTION_KEYS as string[]).includes(value);
}
