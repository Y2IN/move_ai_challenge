/** 코레일 공차 관리 화면 전용 데이터 */

/** 최근 4분기 공차율 추이. 마지막이 현재 분기 */
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

export const trendMeta = {
  title: '공차율 추이',
  note: '4개 분기 연속 하락 · 전 분기 대비 12.5%p 개선',
  currentLabel: '이번 분기',
};

/** 최소 적재 기준. 이 아래는 채워야 할 공차 */
export const MIN_LOAD_RATE = 60;

/** 화차별 정원. korailRows의 wagon 코드로 조회 */
export const wagonCapacity: Record<string, string> = {
  'KRC-1204': '4,550톤',
  'KRC-0871': '4,390톤',
  'KRC-2216': '4,320톤',
  'KRC-0433': '4,020톤',
  'KRC-1587': '3,460톤',
  미배정: '미정',
};

/** 화차형식. korailRows의 sub 문자열에서 꺼내는 대신 코드로 매핑 */
export const wagonType: Record<string, string> = {
  'KRC-1204': '컨테이너',
  'KRC-0871': '유개화차',
  'KRC-2216': '컨테이너',
  'KRC-0433': '무개화차',
  'KRC-1587': '탱크화차',
  미배정: '미배정',
};

export const fillPanel = {
  title: '지금 채우면',
  shortCount: '적재 미달 공차 3편성',
  shortCapacity: '잔여 용량 8,290톤',
  potential: '2,340만 원',
  potentialLabel: '예상 추가 수익',
  body: '최소 적재 기준 60%에 못 미치는 공차입니다. 동일 노선 소량 화물을 합적해 채우면 회송 손실을 수익으로 돌릴 수 있습니다.',
  cta: 'AI 합적으로 채우기',
};

export const header = {
  title: '공차 관리',
  lead: '회송 공차를 채워 공차율을 낮춥니다. 적재 미달 공차부터 확인하세요.',
};
