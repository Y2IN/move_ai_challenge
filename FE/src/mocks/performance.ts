import type { TrendPoint } from './wagons';

/** 코레일 수송 실적 화면 전용 데이터 */

export const header = {
  title: '수송 실적',
  lead: '이번 분기 공차 운영 성과입니다. 리포트로 발행할 수 있습니다.',
};

/** 추가 수익 추이 (단위: 만원) */
export const revenueTrend: TrendPoint[] = [
  { label: '2025 Q3', rate: 2100 },
  { label: '2025 Q4', rate: 3480 },
  { label: '2026 Q1', rate: 5920 },
  { label: '2026 Q2', rate: 8700, current: true },
];

export const trendNotes = {
  vacancy: '4개 분기 연속 하락 · 전 분기 대비 12.5%p 개선',
  revenue: '4개 분기 연속 증가 · 전 분기 대비 +47%',
};

export interface PerfRow {
  quarter: string;
  vacancyRate: string;
  filledWagons: string;
  revenue: string;
  modalShare: string;
  current?: boolean;
}

export const perfHistory: PerfRow[] = [
  { quarter: '2025 Q3', vacancyRate: '38.4%', filledWagons: '41량', revenue: '2,100만 원', modalShare: '12.8%' },
  { quarter: '2025 Q4', vacancyRate: '34.1%', filledWagons: '63량', revenue: '3,480만 원', modalShare: '15.4%' },
  { quarter: '2026 Q1', vacancyRate: '31.2%', filledWagons: '89량', revenue: '5,920만 원', modalShare: '19.1%' },
  {
    quarter: '2026 Q2',
    vacancyRate: '18.7%',
    filledWagons: '128량',
    revenue: '8,700만 원',
    modalShare: '24.6%',
    current: true,
  },
];

export const perfReport = {
  title: '수송 실적 리포트',
  body: '이번 분기 공차율, 채운 화차, 추가 수익, 철도 분담률을 하나의 문서로 정리합니다.',
  cta: '수송 실적 리포트 발행',
  lastTitle: '최근 발행 · 2026년 1분기 리포트',
  lastMeta: 'PDF · 5월 9일',
};
