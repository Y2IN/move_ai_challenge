/** 07 정산 — 협약 이행 현황 */

export const contract = {
  status: '이행 중',
  volume: '4,280톤',
  subsidy: '3억 4,200만 원',
  period: '2026.04.01 ~ 09.30',
  no: 'KLARU-2026-0412',
};

export const achievement = {
  actualTons: '3,120톤',
  contractTons: '4,280톤',
  rate: 73,
  /** 현재 시점 기준 도달해야 할 지점 */
  targetRate: 77,
  gapLabel: '목표 대비 4%p 미달',
  remainWeeks: '6주',
  shortTons: '1,160톤',
  weeklyNeed: '193톤',
};

export const shortfallAlert = {
  title: '현재 추세로는 협약물량 미달이 예상됩니다',
  body: '미달 시 보조금은 실적물량 기준으로 감액 지급됩니다. 부족한 1,160톤을 합적으로 채울 수 있습니다.',
  sideLabel: '동일 노선 합적 대기',
  sideValue: '타사 화물 2건 · 940톤',
  cta: 'AI 합적으로 부족 물량 채우기',
};

export interface RecalcRow {
  label: string;
  contract: string;
  actual: string;
  /** 채택 배지를 붙일 행 */
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
  formulaNote: '국토교통부 고시 제2019-16호 · min(A, B)',
};

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
  {
    no: '1회차',
    date: '2026.04.12',
    route: '울산 → 의왕ICD',
    item: '석유화학제품',
    tons: '620톤',
    waybill: 'KRC-1204-01',
    proof: 'done',
  },
  {
    no: '2회차',
    date: '2026.05.03',
    route: '광양 → 오봉',
    item: '화학원료',
    tons: '510톤',
    waybill: 'KRC-1204-02',
    proof: 'done',
  },
  {
    no: '3회차',
    date: '2026.06.21',
    route: '포항 → 부곡',
    item: '철강재',
    tons: '440톤',
    waybill: 'KRC-1204-03',
    proof: 'done',
  },
  {
    no: '4회차',
    date: '2026.07.15',
    route: '울산 → 의왕ICD',
    item: '석유화학제품',
    tons: '780톤',
    waybill: 'KRC-1204-04',
    proof: 'missing',
  },
];

export const tripSummary = '4회차 · 2,350톤';

export interface DocCheckItem {
  name: string;
  status: string;
  ok: boolean;
}

export const docChecklist: DocCheckItem[] = [
  { name: '운송 실적 증빙', status: '12건', ok: true },
  { name: '세금계산서', status: '완료', ok: true },
  { name: '운송장 사본', status: '1건 누락', ok: false },
  { name: '사업자등록증 사본', status: '완료', ok: true },
];

export const reportBlockedNote = '운송장 사본 1건을 업로드해주세요';
