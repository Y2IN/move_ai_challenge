/** 코레일 화주 · 영업 화면 전용 데이터 */

export const header = {
  title: '화주 · 영업',
  lead: '합적에 참여한 화주별 협약 이행을 관리합니다. 미달 위험 화주와 재계약 대상을 먼저 확인하세요.',
};

export type ClientStatus = '정상' | '미달 위험' | '신규';

export const STATUS_STYLE: Record<ClientStatus, string> = {
  정상: 'bg-[#EAF8F1] text-[#12A87A]',
  '미달 위험': 'bg-[#FFF4E0] text-[#C77700]',
  신규: 'bg-[#E8F3FF] text-[#1B64DA]',
};

export interface ClientStat {
  label: string;
  value: string;
  delta: string;
  deltaTone: 'up' | 'flat';
}

export const clientStats: ClientStat[] = [
  { label: '합적 참여 화주', value: '128개사', delta: '이번 분기 누적', deltaTone: 'flat' },
  { label: '신규 B2B 화주', value: '24개사', delta: '합적으로 신규 유입', deltaTone: 'up' },
  { label: '재계약 대상', value: '9개사', delta: '60일 내 협약 만료', deltaTone: 'flat' },
  { label: '미달 위험 화주', value: '3개사', delta: '이행률 80% 미만', deltaTone: 'flat' },
];

export interface ClientRow {
  id: string;
  name: string;
  /** 주 노선 */
  route: string;
  contractTons: string;
  actualTons: string;
  /** 이행률 (%) */
  rate: number;
  /** 공차 기여 — 채운 화차량 */
  contribution: string;
  status: ClientStatus;
}

export const clientRows: ClientRow[] = [
  {
    id: 'c1',
    name: '남광유화',
    route: '울산 → 부산신항',
    contractTons: '2,880톤',
    actualTons: '720톤',
    rate: 25,
    contribution: '0량',
    status: '미달 위험',
  },
  {
    id: 'c2',
    name: '청우물류',
    route: '여수 → 제천',
    contractTons: '3,200톤',
    actualTons: '1,760톤',
    rate: 55,
    contribution: '5량',
    status: '미달 위험',
  },
  {
    id: 'c3',
    name: '대명케미칼',
    route: '광양 → 오봉',
    contractTons: '2,400톤',
    actualTons: '1,780톤',
    rate: 74,
    contribution: '8량',
    status: '미달 위험',
  },
  {
    id: 'c4',
    name: '우진산업',
    route: '울산 → 의왕ICD',
    contractTons: '1,200톤',
    actualTons: '880톤',
    rate: 73,
    contribution: '3량',
    status: '신규',
  },
  {
    id: 'c5',
    name: '삼호정밀',
    route: '여수 → 제천',
    contractTons: '2,600톤',
    actualTons: '2,180톤',
    rate: 84,
    contribution: '9량',
    status: '정상',
  },
  {
    id: 'c6',
    name: '한림케미칼',
    route: '광양 → 오봉',
    contractTons: '1,760톤',
    actualTons: '1,540톤',
    rate: 88,
    contribution: '12량',
    status: '정상',
  },
  {
    id: 'c7',
    name: '동해철강',
    route: '포항 → 부곡',
    contractTons: '3,900톤',
    actualTons: '3,540톤',
    rate: 91,
    contribution: '10량',
    status: '정상',
  },
  {
    id: 'c8',
    name: '대성물산',
    route: '울산 → 의왕ICD',
    contractTons: '1,940톤',
    actualTons: '1,860톤',
    rate: 96,
    contribution: '12량',
    status: '정상',
  },
];

/** 이행률이 이 아래면 미달 위험 강조 */
export const RISK_RATE = 80;

export interface RenewalItem {
  name: string;
  dday: string;
  note: string;
}

export const salesPanel = {
  title: '영업 액션',
  renewalTitle: '재계약 임박',
  renewals: [
    { name: '대성물산', dday: 'D-18', note: '이행률 96% · 증액 제안 가능' },
    { name: '동해철강', dday: 'D-31', note: '이행률 91% · 노선 추가 검토' },
    { name: '청우물류', dday: 'D-44', note: '이행률 55% · 물량 재조정 필요' },
  ] as RenewalItem[],
  newTitle: '신규 유입 화주',
  newSummary: '24개사',
  newNote: '합적 매칭으로 처음 철도를 쓴 화주입니다. 단독 협약으로 전환할 여지가 있습니다.',
  cta: '영업 리스트 내보내기',
};
