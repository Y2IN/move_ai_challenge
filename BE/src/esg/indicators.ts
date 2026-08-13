/**
 * K-ESG 지표표 (api_list #40).
 *
 * 집계 결과를 K-ESG 가이드라인 환경(E) 영역의 세 지표 칸에 꽂아 넣습니다.
 *
 *   E-3-2  온실가스 배출량 (Scope 3)   ← 우리가 만드는 값의 본체
 *   E-7-1  대기오염물질 배출량          ← NOx·SOx·PM2.5 감축량
 *   E-3-3  온실가스 배출량 검증         ← 산정 근거·검증 가능성 (정성 지표)
 *
 * ⚠️ **여기서 숫자를 만들지 않습니다.** 전부 `EsgAggregate` 에 이미 있는 값을
 *    표시용 문자열로 포맷할 뿐입니다. 계산이 필요하면 period.ts 로 올리세요.
 */

import {
  AIR_POLLUTANT_SCOPE_NOTE,
  CARBON_PRICE_IN_USE,
  SOURCES,
  VERIFIED,
} from "../constants";
import type { EsgAggregate, KesgIndicator, PollutantKey } from "./types";

const fmt = (n: number, digits = 1) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;
const krw = (n: number) => n.toLocaleString("ko-KR");

/**
 * 부호를 반드시 붙여 표기합니다.
 *
 * 대기오염물질은 **증가할 수 있습니다.** 디젤 기관차는 후처리 장치가 없어 연료 1L당
 * NOx·PM 배출이 대형 화물차보다 많고, 철도 간선거리가 도로 직행거리보다 길면
 * 연료 효율 이득이 상쇄됩니다. `25.88` 처럼 부호 없이 인쇄하면 증가분이 감축으로 읽힙니다.
 */
const signed = (n: number, digits = 1) => (n >= 0 ? "+" : "−") + fmt(Math.abs(n), digits);

/** Scope 3 중 물류가 속하는 카테고리 — 서식에 그대로 인쇄됩니다. */
export const SCOPE3_CATEGORY = "Category 4 (Upstream transportation and distribution)";

/**
 * 세 값(기준선·실제·감축량)을 각각 반올림하므로 표시 값끼리 뺄셈이 마지막 자리에서
 * 안 맞을 수 있습니다. 감축량을 `표시된 기준선 − 표시된 실제` 로 바꿔 계산하면 표는
 * 깔끔해지지만 산정 결과와 다른 값을 공시하게 됩니다. 실제 보고서와 같이
 * **각 값을 그대로 두고 단수 처리를 명시**합니다. 원자료는 #42 로 내보냅니다.
 */
const ROUNDING_NOTE =
  "표시 값은 항목별로 반올림한 것으로, 표시 값 간 가감이 마지막 자리에서 일치하지 않을 수 있습니다. " +
  "검증용 원자료는 Scope 3 내보내기를 통해 제공합니다.";

export function buildIndicators(agg: EsgAggregate): KesgIndicator[] {
  return [scope3(agg), airQuality(agg), verification(agg)];
}

// ── E-3-2 온실가스 배출량 (Scope 3) ────────────────────────────

function scope3(agg: EsgAggregate): KesgIndicator {
  // 금전 환산액은 calc.ts 가 화주 건별로 계산한 값의 합을 그대로 씁니다.
  // 여기서 `표시용으로 반올림된 감축량 × 단가` 로 다시 구하면 반올림 오차가
  // 50,000배로 증폭되어 같은 응답 안에서 두 개의 다른 금액이 나옵니다.
  const ghgKrw = agg.benefitItems.find((b) => b.key === "ghg")?.amountKrw ?? 0;

  return {
    code: "E-3-2",
    name: "온실가스 배출량 (Scope 3)",
    frameworks: ["K-ESG E-3-2", "GRI 305-3", "ISSB IFRS S2 · Scope 3 Cat.4"],
    headline: fmt(agg.reducedCo2Ton),
    headlineUnit: "tCO₂eq 감축",
    metrics: [
      {
        label: `기준선 배출량 (도로 직행 가정)`,
        value: fmt(agg.baselineCo2Ton),
        unit: "tCO₂eq",
        supplementary: true,
      },
      { label: "실제 배출량 (철도 간선 + 양단 셔틀)", value: fmt(agg.actualCo2Ton), unit: "tCO₂eq" },
      { label: "감축량", value: fmt(agg.reducedCo2Ton), unit: "tCO₂eq" },
      { label: "감축률", value: pct(agg.reductionRate), unit: "" },
      { label: "활동량 (수송량)", value: fmt(agg.totalTon), unit: "톤" },
      {
        label: "활동량 (수송 활동)",
        value: krw(agg.volumes.railTonKm + agg.volumes.shuttleTonKm),
        unit: "ton·km",
        supplementary: true,
      },
      {
        label: `감축량 금전 환산 (${krw(CARBON_PRICE_IN_USE)}원/tCO₂eq)`,
        value: krw(ghgKrw),
        unit: "원",
        supplementary: true,
      },
    ],
    basis:
      `${SCOPE3_CATEGORY} 에 해당하는 물류 배출량입니다. ` +
      `수송수단별 배출원단위(g-CO₂eq/ton·km)에 실제 수송 실적 ton·km 를 곱해 산정했으며, ` +
      `기준선은 동일 물량을 전 구간 도로로 직행 운송했을 경우입니다. ` +
      `철도 전환 후에도 공장↔역 구간은 도로 운송이므로 실제 배출량에 포함했습니다. ` +
      ROUNDING_NOTE,
    source: SOURCES.co2,
    verified: VERIFIED,
  };
}

// ── E-7-1 대기오염물질 배출량 ──────────────────────────────────

function airQuality(agg: EsgAggregate): KesgIndicator {
  const find = (key: PollutantKey) => agg.pollutants.find((p) => p.key === key);
  const nox = find("nox");
  const increased = agg.pollutants.filter((p) => p.reducedKg < 0);

  return {
    code: "E-7-1",
    name: "대기오염물질 배출량",
    /**
     * ⚠️ **K-ESG E-7-1 을 직접 충족하지 않습니다. 질량(kg)은 GRI 305-7 요구사항입니다.**
     *
     * K-ESG 가이드라인 v2.0 p.74 [데이터산식]:
     *   "대기오염물질 배출 = 질소산화물, 황산화물, 미세먼지의 **배출농도(PPM, mg/㎥)**"
     * 즉 E-7-1 이 요구하는 것은 농도이며, 총배출 질량도 금액도 아닙니다.
     * 게다가 우리 값은 **수송 단계** 배출이라 사업장 굴뚝 농도와 성격이 다릅니다.
     *
     * 그래서 프레임워크 표기를 GRI 305-7 로만 두고, E-7-1 은 참고 관련 지표로만 답니다.
     * 공시 담당자가 E-7-1 칸에 이 숫자를 그대로 옮기면 지표 정의와 불일치합니다.
     *
     * 출처: https://k-esg.org/uploads/post/2024/12/e6d63e812307ab3e093a783e074db91d.pdf (p.74)
     * ※ 이 근거는 1차 출처 조사로 확인했으나 적대적 검증이 중단된 상태입니다.
     */
    frameworks: ["GRI 305-7", "K-ESG E-7-1 (참고 — 단위 상이)"],
    headline: nox ? signed(nox.reducedKg, 2) : "0.00",
    // 부호에 따라 단위 문구가 바뀝니다. 증가한 물질을 "감축"으로 인쇄하면 허위 공시입니다.
    headlineUnit: `kg NOx ${nox && nox.reducedKg < 0 ? "증가" : "감축"}`,
    metrics: [
      ...agg.pollutants.flatMap((p) => [
        { label: `${p.label} 기준선`, value: fmt(p.baselineKg, 2), unit: "kg", supplementary: true },
        { label: `${p.label} 실제`, value: fmt(p.actualKg, 2), unit: "kg" },
        {
          // "감축량"이라고 못 박지 않습니다. 음수면 증가입니다.
          label: `${p.label} 증감 (− 가 증가)`,
          value: signed(p.reducedKg, 2),
          unit: "kg",
        },
      ]),
      {
        label: "증가한 물질",
        value: increased.length > 0 ? increased.map((p) => p.label).join(", ") : "없음",
        unit: "",
        supplementary: true,
      },
    ],
    basis:
      `도로 화물차와 철도의 대기오염물질 배출원단위(g/ton·km)에 수송 실적 ton·km 를 곱해 산정했습니다. ` +
      `사업장 굴뚝 배출이 아닌 수송 단계 배출이므로 사업장 배출량과 합산하지 마십시오. ` +
      AIR_POLLUTANT_SCOPE_NOTE +
      (increased.length > 0
        ? ` 본 기간에는 ${increased
            .map((p) => p.label)
            .join("·")} 이(가) 기준선 대비 증가했습니다. ` +
          `디젤 기관차는 SCR·DPF 후처리가 없어 연료 1L당 NOx·PM 배출이 대형 화물차보다 많고, ` +
          `철도 간선거리가 도로 직행거리보다 길어 연료 효율 이득이 상쇄되기 때문입니다. ` +
          // 이 문자열은 HTML·CSV·엑셀에 그대로 인쇄됩니다. 마크다운 강조를 쓰면 별표가 보입니다.
          `또한 기준선을 도로화물 평균이 아닌 25톤급 간선 직행 대형 화물차로 잡았습니다. ` +
          `소형 배송차량이 포함된 도로화물 전체 평균을 기준선으로 쓰면 철도가 7~11배 우위로 ` +
          `나오지만, 실제로 이 화물이 도로로 갔다면 대형 트럭이 실었을 것이므로 ` +
          `유리한 평균 대신 가장 엄격한 기준선을 적용했습니다. ` +
          `온실가스 감축과 달리 대기오염물질은 견인 방식에 따라 결과가 달라집니다.`
        : "") +
      ` ${ROUNDING_NOTE}`,
    source: SOURCES.airPollutant,
    verified: VERIFIED,
  };
}

// ── E-3-3 온실가스 배출량 검증 ─────────────────────────────────

/**
 * 정성 지표입니다. 숫자 칸이 아니라 **"이 배출량을 제3자가 검증할 수 있는가"** 를 묻습니다.
 *
 * 검증받지 않았다는 사실을 숨기면 공시 위반입니다. 대신 **검증 가능한 상태인지**
 * (활동데이터 추적성 · 계수 출처 명시 · 원자료 내보내기)를 근거로 제시합니다.
 */
function verification(agg: EsgAggregate): KesgIndicator {
  const readiness = [
    `활동데이터 ${agg.legCount}건(편성 ${agg.tripCount}회)이 수송 일자·화주·노선 단위로 추적 가능`,
    `배출계수 출처 명시 및 계수 버전 고정 (${agg.coefficientVersion})`,
    "원자료 CSV 내보내기 지원 — 검증기관이 재계산 가능",
  ];

  return {
    code: "E-3-3",
    name: "온실가스 배출량 검증",
    frameworks: ["K-ESG E-3-3", "ISO 14064-3"],
    headline: VERIFIED ? "내부 산정 · 계수 검증 완료" : "내부 산정 (제3자 검증 미실시)",
    headlineUnit: "",
    metrics: [
      { label: "검증 수준", value: VERIFIED ? "계수 1차 출처 확인" : "미검증", unit: "" },
      { label: "계수 버전", value: agg.coefficientVersion, unit: "" },
      { label: "산정 대상 활동데이터", value: `${agg.legCount}`, unit: "건" },
      { label: "산정 대상 편성", value: `${agg.tripCount}`, unit: "회" },
      ...readiness.map((text, i) => ({
        label: `검증 가능성 근거 ${i + 1}`,
        value: text,
        unit: "",
        supplementary: true,
      })),
    ],
    basis: VERIFIED
      ? "배출계수를 1차 출처로 확인했습니다. 제3자 검증기관 검증은 별도 절차입니다."
      : "본 배출량은 내부 산정치이며 제3자 검증을 받지 않았습니다. " +
        "다만 활동데이터가 건별로 추적 가능하고 계수 출처와 버전이 고정되어 있어 " +
        "외부 검증기관이 동일 결과를 재현할 수 있는 상태입니다.",
    source: SOURCES.kesg,
    verified: VERIFIED,
  };
}
