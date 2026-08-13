/**
 * 분기별 실적 추이 클라이언트 (`/api/dashboard/history`).
 *
 * #7 은 이번 분기 한 점만 줍니다. 추이 차트·분기별 실적표는 이 엔드포인트를 씁니다.
 * 각 점은 그 분기를 #40 으로 조회한 값과 같습니다 — 서버가 같은 집계 함수를 부릅니다.
 */

import type { HistoryPoint, HistoryResponse, HistorySeries, MetricUnit } from '@railhub/be/history';
import type { Persona } from '@railhub/be/types';
import { getJson } from './api';
import { formatCo2, formatKrw, formatNumber, formatPct } from './format';

export type { HistoryPoint, HistoryResponse, HistorySeries, MetricUnit };

export function fetchHistory(persona: Persona, quarters = 4): Promise<HistoryResponse> {
  return getJson<HistoryResponse>(`/api/dashboard/history?persona=${persona}&quarters=${quarters}`);
}

/** 단위별 표기. 값을 만드는 건 서버, 읽는 모양을 정하는 건 화면입니다. */
export function formatMetric(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'percent':
      return formatPct(value);
    case 'krw':
      return formatKrw(value);
    case 'ton':
      return `${formatNumber(value, 1)}t`;
    case 'co2':
      return formatCo2(value);
    default:
      return `${formatNumber(value)}건`;
  }
}

/** 차트가 그리는 한 점. `rate` 는 TrendChart 가 쓰는 축 값입니다. */
export interface TrendPoint {
  label: string;
  rate: number;
  current?: boolean;
}

/**
 * 지표 하나를 차트용 시계열로 뽑습니다.
 *
 * 비율(0~1)은 그대로 그리면 막대가 안 보이므로 % 로 올립니다. 실적이 없는 분기는
 * 0 으로 남겨 둡니다 — 빼 버리면 축이 촘촘해져 "쭉 잘해 왔다"처럼 보입니다.
 */
export function toTrend(items: HistoryPoint[], key: string, unit: MetricUnit): TrendPoint[] {
  return items.map((p) => ({
    label: p.label,
    rate: unit === 'percent' ? Math.round(p.metrics[key] * 1000) / 10 : p.metrics[key],
    current: p.current,
  }));
}

/** "4개 분기 중 3개 분기 실적 있음 · 전 분기 대비 +12%" 같은 한 줄 */
export function trendNote(items: HistoryPoint[], key: string, unit: MetricUnit): string {
  const withData = items.filter((p) => p.hasData);
  if (withData.length < 2) return `실적이 있는 분기 ${withData.length}개`;

  const last = withData[withData.length - 1];
  const prev = withData[withData.length - 2];
  const before = prev.metrics[key];
  const now = last.metrics[key];
  if (!before) return `${prev.label} 실적 없음`;

  const deltaPct = Math.round(((now - before) / before) * 1000) / 10;
  const sign = deltaPct > 0 ? '+' : '';
  return `${prev.label} 대비 ${sign}${deltaPct}% · 현재 ${formatMetric(now, unit)}`;
}
