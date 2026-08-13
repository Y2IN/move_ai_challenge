/** 05 편익 대시보드 */

export const benefitPeriod = '2026년 2분기 · 12건 4,280톤 · 환경부 배출계수와 KOTI 산식 기준';

export interface ModeRow {
  label: string;
  road: string;
  rail: string;
  /** 철도 쪽에 붙는 강조 배지 */
  railBadge?: string;
}

export const modeRows: ModeRow[] = [
  { label: '운송비', road: '5억 800만 원', rail: '4억 1,500만 원' },
  { label: '탄소 배출', road: '246 tCO₂eq', rail: '64 tCO₂eq', railBadge: '74% 감소' },
  { label: '화차 적재율', road: '—', rail: '94%' },
];

export interface BenefitItem {
  name: string;
  basis: string;
  amount: string;
  source: string;
}

export const benefitItems: BenefitItem[] = [
  { name: '온실가스 감축', basis: '182 tCO₂eq', amount: '1억 5,800만 원', source: '환경부 배출계수' },
  { name: '대기오염 저감', basis: 'NOx·SOx·PM2.5', amount: '6,400만 원', source: '환경부 사회적비용 단가' },
  { name: '교통사고 예방', basis: '대형화물차 45대 감소', amount: '5,300만 원', source: 'KOTI 산식' },
  { name: '도로혼잡 완화', basis: '차량·km 감소분', amount: '8억 6,500만 원', source: 'KOTI 산식' },
];

export const subsidyFormula = {
  totalLabel: '사회환경적 편익 계',
  total: '11억 4,000만 원',
  rateLabel: '× 30% (고시상 상한 기준)',
  result: '3억 4,200만 원',
  basis:
    '「전환교통 협약에 관한 규정」(국토교통부 고시 제2019-16호) — 보조금은 전환 추가비용과 사회환경적 절감비용의 30% 중 작은 값',
};

export const analogies = {
  pine: { value: '4만 그루', label: '소나무 식재 효과' },
  truck: { value: '45대', label: '대형 트럭 도심 진입 차단' },
  note: '국토교통부는 전환교통 지원사업 10년 실적을 나무 3억 그루 식재 효과로 환산해 발표한 바 있습니다.',
};

/** 탄소 배출 비교 막대. road를 100%로 두고 rail 비율을 계산한다 */
export const carbonChart = {
  road: { label: '도로 단독', value: '246 tCO₂eq', ratio: 100 },
  rail: { label: '철도 합적', value: '64 tCO₂eq', ratio: 26 },
};
