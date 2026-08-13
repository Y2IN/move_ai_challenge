/** 07 정산 — 협약 이행 현황 · 기준일 2026.08.18 로 전 수치 정합 */

export const asOf = '2026.08.18';
export const periodName = '2026 2차 협약';

export const contract = {
  status: '이행 중',
  volume: '4,280톤',
  subsidy: '3억 4,200만 원',
  period: '2026.04.01 ~ 09.30',
  no: 'KLARU-2026-0412',
};

/** 헤더 드롭다운/서브타이틀용 */
export const header = {
  periodSelect: `${periodName} (${contract.period})`, // "하반기/2분기" 표현 폐기
  subtitle: '협약 전체 대비 현재까지 실적',
};

export const achievement = {
  actualTons: '3,120톤',
  contractTons: '4,280톤',
  rate: 73,
  /** 현재 시점 기준 도달해야 할 지점 = 협약 기간 경과율 */
  targetRate: 77,
  gapLabel: '목표 대비 4%p 미달',
  elapsedLabel: '6개월 중 약 4.6개월 경과 · 협약 전체 기준', // was "3개월 경과"
  remainWeeks: '6주',
  shortTons: '1,160톤',
  weeklyNeed: '193톤',
};

export const shortfallAlert = {
  title: '현재 추세로는 협약물량 미달이 예상됩니다',
  body: '미달 시 보조금은 실적물량 기준으로 감액 지급됩니다. 부족분 1,160톤 중 940톤을 합적으로 채울 수 있습니다.',
  sideLabel: '동일 노선 합적 대기',
  sideValue: '타사 화물 2건 · 940톤',
  cta: 'AI 합적으로 부족 물량 채우기',
};

export interface RecalcRow {
  label: string;
  contract: string;
  actual: string;
  adopted?: boolean;
}

export const recalcRows: RecalcRow[] = [
  { label: '물량', contract: '4,280톤', actual: '3,120톤' },
  { label: '추가비용 (A)', contract: '4억 1,500만 원', actual: '3억 250만 원' },
  { label: '편익 × 30% (B)', contract: '3억 4,200만 원', actual: '2억 4,900만 원', adopted: true },
];

export const recalcResult = {
  label: '확정 보조금',
  contract: '3억 4,200만 원',
  actual: '2억 4,900만 원',
  diff: '△9,300만 원',
  asOfLabel: `${asOf} 기준`,            // was "2026.06.30 기준"
  reductionNote: '협약 기준 대비 27% 감액',
  formulaNote: '국토교통부 고시 제2019-16호 · min(A, B)',
};

/** 정산 히스토리 — 기간 비중첩, 감액 값 전부 상이 */
export interface HistoryRow {
  period: string;
  no: string;
  span: string;
  contractTons: string;
  actualTons: string;
  subsidy: string;
  reduction: string;
  status: string;
  tone: 'success' | 'warn';
  current?: boolean;
}

export const history: HistoryRow[] = [
  {
    period: '2025 2차 협약',
    no: 'KLARU-2025-0917',
    span: '2025.07.01 ~ 12.31',
    contractTons: '4,000톤',
    actualTons: '4,120톤',
    subsidy: '3억 1,000만 원',
    reduction: '없음',
    status: '전액지급',
    tone: 'success',
  },
  {
    period: '2026 1차 협약',
    no: 'KLARU-2026-0108',
    span: '2026.01.01 ~ 03.31',
    contractTons: '4,600톤',
    actualTons: '3,540톤',
    subsidy: '2억 6,700만 원',
    reduction: '△8,000만 원',
    status: '감액지급',
    tone: 'warn',
  },
  {
    period: '2026 2차 협약',
    no: 'KLARU-2026-0412',
    span: '2026.04.01 ~ 09.30',
    contractTons: '4,280톤',
    actualTons: '3,120톤',
    subsidy: '2억 4,900만 원 예상',
    reduction: '△9,300만 원 예상',
    status: '이행 중',
    tone: 'warn',
    current: true,
  },
];

export const historySummary = '협약 3건';

export type ProofStatus = 'done' | 'missing';

export interface TripRow {
  no: string;
  date: string;
  route: string;
  item: string;
  tons: string;
  waybill: string;
  proof: ProofStatus;
}

export const tripRows: TripRow[] = [
  { no: '1회차', date: '2026.04.12', route: '울산 → 의왕ICD', item: '석유화학제품', tons: '620톤', waybill: 'KRC-1204-01', proof: 'done' },
  { no: '2회차', date: '2026.05.03', route: '광양 → 오봉', item: '화학원료', tons: '510톤', waybill: 'KRC-1204-02', proof: 'done' },
  { no: '3회차', date: '2026.06.21', route: '포항 → 부곡', item: '철강재', tons: '440톤', waybill: 'KRC-1204-03', proof: 'done' },
  { no: '4회차', date: '2026.07.15', route: '울산 → 의왕ICD', item: '석유화학제품', tons: '780톤', waybill: 'KRC-1204-04', proof: 'missing' },
];

/** 상세 4회차(2,350) + 나머지 요약 = 실적물량 3,120 정합용 */
export const tripMore = { label: '외 4회차', tons: '770톤' };
export const tripSummary = '8회차 · 3,120톤'; // was "4회차 · 2,350톤"

export interface DocCheckItem {
  name: string;
  status: string;
  ok: boolean;
  file?: { name: string; date: string }; // 첨부 파일 칩
}

export const docChecklist: DocCheckItem[] = [
  { name: '운송 실적 증빙', status: '8건', ok: true, file: { name: '실적내역_2026-2차.xlsx', date: '08.10' } },
  { name: '세금계산서', status: '완료', ok: true, file: { name: '세금계산서_2026-2차.pdf', date: '07.02' } },
  { name: '운송장 사본', status: '1건 누락', ok: false }, // 파일 없음 → 인라인 업로드
  { name: '사업자등록증 사본', status: '완료', ok: true, file: { name: '사업자등록증_embark.pdf', date: '04.01' } },
];

export const reportBlockedNote = '운송장 사본 1건을 업로드해주세요';
