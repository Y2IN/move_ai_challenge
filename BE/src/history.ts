/**
 * 분기별 실적 추이 (GET /api/dashboard/history).
 *
 * #7 대시보드는 **이번 분기 한 점**만 줍니다. 추이 차트는 지난 분기가 있어야
 * 그릴 수 있어서, 수송 실적 원장(`esg/ledger.json`)을 분기마다 다시 집계합니다.
 *
 * ⚠️ 여기서 새 계산식을 만들지 않습니다. `aggregate()` 를 분기별로 부를 뿐이라
 *    추이의 각 점은 그 분기를 #40 으로 조회한 값과 정확히 같습니다. 둘이 갈라지면
 *    "리포트에는 112톤인데 차트에는 108톤" 같은 일이 생깁니다.
 *
 * 원장에 없는 분기는 값을 지어내지 않고 `hasData: false` 로 비워 보냅니다.
 */

import { aggregate } from "./esg/period";
import { parsePeriod } from "./esg/period";
import type { Persona } from "./types";

export type MetricUnit = "percent" | "krw" | "ton" | "count" | "co2";

export interface HistorySeries {
  key: string;
  label: string;
  unit: MetricUnit;
  /** 차트에서 강조할 주 지표인지 */
  primary?: boolean;
}

export interface HistoryPoint {
  /** "2026Q2" */
  period: string;
  /** "2026 Q2" — 차트 축에 그대로 찍는 라벨 */
  label: string;
  /** 조회 시점이 속한 분기 */
  current: boolean;
  /** 원장에 실적이 있는 분기인지. false 면 값이 전부 0 입니다 */
  hasData: boolean;
  metrics: Record<string, number>;
}

export interface HistoryResponse {
  persona: Persona;
  series: HistorySeries[];
  items: HistoryPoint[];
}

/**
 * 같은 원장을 보지만 **보는 사람이 다릅니다.**
 *   기업   자기가 얼마나 줄였고 얼마를 벌었나 (감축·편익·물량)
 *   코레일 화차를 얼마나 채웠나 (편성 수·적재율·물량)
 *
 * 공차율·추가 운송 수익은 원장에 없습니다 — 원장은 "실린 것"만 담고 "비어서 떠난
 * 화차"는 담지 않기 때문입니다. 없는 값을 만들어 채우는 대신, 원장이 실제로
 * 답할 수 있는 지표를 씁니다.
 */
const SERIES: Record<Persona, HistorySeries[]> = {
  corp: [
    { key: "reducedCo2Ton", label: "탄소 감축", unit: "co2", primary: true },
    { key: "totalBenefitKrw", label: "사회·환경 편익", unit: "krw", primary: true },
    { key: "totalTon", label: "전환 물량", unit: "ton" },
    { key: "reductionRate", label: "감축률", unit: "percent" },
  ],
  korail: [
    { key: "avgLoadRate", label: "평균 적재율", unit: "percent", primary: true },
    { key: "totalTon", label: "수송 물량", unit: "ton", primary: true },
    { key: "tripCount", label: "편성 수", unit: "count" },
    { key: "legCount", label: "화주 건수", unit: "count" },
  ],
};

/** "2026Q2" 에서 n 분기 전 id. 연도를 넘어가면 알아서 내려갑니다. */
function shiftQuarter(year: number, quarter: number, back: number): { year: number; quarter: number } {
  const zero = year * 4 + (quarter - 1) - back;
  return { year: Math.floor(zero / 4), quarter: (zero % 4) + 1 };
}

/**
 * 최근 `quarters` 분기 추이. `baseDate` 를 주면 그 시점 기준으로 셉니다
 * (시연에서 "오늘" 을 고정할 때 씁니다).
 */
export function getHistory(
  persona: Persona,
  quarters = 4,
  baseDate?: string,
): HistoryResponse {
  const count = Math.min(Math.max(quarters, 1), 12);
  // 기준 분기 = 직전 완료 분기. #40 과 같은 규칙을 쓰려고 parsePeriod 를 그대로 씁니다.
  const base = parsePeriod(undefined, baseDate);
  const [baseYear, baseQuarter] = base.id.split("Q").map(Number);

  const items: HistoryPoint[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const { year, quarter } = shiftQuarter(baseYear, baseQuarter, back);
    const id = `${year}Q${quarter}`;
    const agg = aggregate({ period: parsePeriod(id) });

    items.push({
      period: id,
      label: `${year} Q${quarter}`,
      current: back === 0,
      hasData: agg.tripCount > 0,
      metrics: {
        reducedCo2Ton: agg.reducedCo2Ton,
        totalBenefitKrw: agg.totalBenefitKrw,
        totalTon: agg.totalTon,
        reductionRate: agg.reductionRate,
        avgLoadRate: agg.avgLoadRate,
        tripCount: agg.tripCount,
        legCount: agg.legCount,
        shipperCount: agg.shipperCount,
      },
    });
  }

  return { persona, series: SERIES[persona], items };
}
