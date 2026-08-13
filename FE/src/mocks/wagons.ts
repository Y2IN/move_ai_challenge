/**
 * 코레일 공차율 시계열.
 *
 * ⚠️ **분기별 시계열 API 가 없습니다.** #7 대시보드는 이번 분기 한 점만 주고,
 *    지난 분기를 돌려주는 엔드포인트가 없어 추이 차트를 그릴 수 없습니다.
 *    아래 값은 그래서 남아 있는 큐레이션 데이터이고, 화면은 이 사실을
 *    "시계열 API 미연동" 으로 표시합니다.
 *
 *    붙일 때: `GET /api/dashboard/history?persona=korail&quarters=4` 같은 라우트가
 *    생기면 이 상수를 지우고 그 응답을 그대로 쓰면 됩니다.
 */

/** 최근 4분기 추이. 마지막이 현재 분기 */
export interface TrendPoint {
  label: string;
  rate: number;
  current?: boolean;
}

export const wagonTrend: TrendPoint[] = [
  { label: '2025 Q3', rate: 38.4 },
  { label: '2025 Q4', rate: 34.1 },
  { label: '2026 Q1', rate: 31.2 },
  { label: '2026 Q2', rate: 18.7, current: true },
];
