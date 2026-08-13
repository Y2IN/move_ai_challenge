/** 01 랜딩 · 02 로그인 */

export const brand = {
  name: '알뜰철도 X',
  tagline: '철도를 채우는 순간, ESG가 완성됩니다',
  headline: ['흩어진 화물을 모아 빈 화차를 채우고,', '그 기록을 ESG 자산으로 환전합니다'],
  subheadline: '소량 화물을 모아 코레일 빈 화차에 매칭하고, 그 기록을 공시 가능한 자산으로 환전합니다.',
};

export const heroAmount = {
  caption: '이번 분기 전환교통 보조금 예상액',
  value: '3억 4,200만',
  unit: '원',
  krw: '₩342,000,000',
  delta: '전 분기 대비 +38%',
};

export const heroChips = [
  { label: '온실가스 감축', value: '1억 5,800만' },
  { label: '대기오염 저감', value: '6,400만' },
  { label: '교통사고 예방', value: '5,300만' },
  { label: '도로혼잡 완화', value: '8억 6,500만' },
];

export const heroFootnote = '누적 합적 화주 128개사 · 채운 공차 1,043량 · 코레일 공차 노선 실시간 연동';

export const marketingNav = [
  { label: '서비스 소개', href: '#how' },
  { label: '작동 방식', href: '#how-agent' },
  { label: 'ESG 리포트', href: '#esg-report' },
];

export const howItWorks = [
  {
    step: '1',
    title: '화물을 등록합니다',
    body: '엑셀, ERP 연동, 자연어 입력 모두 가능합니다. "울산에서 경기까지 8톤" 한 줄이면 AI가 노선과 물량을 읽어 냅니다.',
  },
  {
    step: '2',
    title: 'AI가 모아서 화차를 채웁니다',
    body: '동선이 비슷한 타사 소량 화물을 그룹핑하고, 코레일의 복귀 공차에 배정합니다. 평균 운송비 18% 절감.',
  },
  {
    step: '3',
    title: 'ESG 자산으로 환전합니다',
    body: '탄소·대기오염·사고·혼잡 편익을 원화로 환산하고, K-ESG 공시 보고서 초안까지 자동으로 씁니다.',
  },
];

export const landingCta = {
  title: '2027년 Scope 3 공시, 지금 준비하세요',
  body: '첫 화물 등록부터 리포트 발행까지 5분이면 충분합니다.',
  button: '바로 시작하기',
};

export const landingStats = [
  { label: '누적 합적 화주', value: '128개사' },
  { label: '채운 공차', value: '1,043량' },
];

export const howSection = {
  badge: '서비스 소개',
  title: '화물을 올리면, 나머지는 AI가 합니다',
  lead: '엑셀 한 장, 또는 한 문장이면 됩니다',
};

/* ── 작동 방식 · 조율 에이전트 ───────────────────────── */

export const agentSection = {
  badge: '작동 방식',
  title: '조건이 안 맞으면 협상해서 채웁니다',
  lead: '화주가 문장으로 적어 둔 제약을 읽고 절대 조건과 조정 가능 조건을 나눕니다. 양보를 요청할 화주를 고르고, 그 화주에게 통할 근거를 각각 다르게 씁니다.',
  cardBadge: '조율 에이전트',
  cardTitle: ['편성이 깨질 때', '포기하지 않습니다'],
  cardBody:
    '출발일이 하루 어긋나거나 물량이 정원에 못 미치면 매칭은 실패합니다. 그 어긋남 대부분은 화주가 못 바꾸는 게 아니라 바꿀 이유를 못 받은 것입니다.',
  cardCaveat: '양보 대가가 절감액보다 크면 제안하지 않습니다. 손해 보는 화주를 만들지 않는 것이 조건입니다.',
};

export const agentInput = {
  caption: '화주가 적는 문장',
  quote: '"22일까지 도착이면 됩니다. 창고 공간은 여유 있어요"',
  tags: [
    { kind: 'absolute' as const, label: '절대 · 08.22 도착' },
    { kind: 'adjustable' as const, label: '조정 가능 · 발송일 1~2일' },
  ],
};

export const agentOutput = {
  caption: 'AI가 쓴 제안 · 화주 발송용',
  message:
    '"08.17 발송을 08.18로 하루만 옮기시면 단독 발송 대비 운송비를 19% 아낄 수 있습니다. 도착은 08.21로 기한 하루 전입니다."',
  status: '수락',
  basis: '보관비 620만 원 대비 절감 2,180만 원',
  loadChange: '적재율 41% → 75%',
};

/* ── ESG 리포트 섹션 ────────────────────────────────── */

export const esgSection = {
  badge: 'ESG 리포트',
  title: '제출할 수 있는 문서로 나옵니다',
  lead: '운송 실적에서 바로 두 가지가 만들어집니다.\n관공서 서식 그대로의 보조금 사업계획서, 그리고 공시에 넣는 K-ESG 지표표입니다.',
  legend: [
    { tone: 'grey' as const, label: '수치는 법정 산식으로 계산' },
    { tone: 'blue' as const, label: 'AI는 서술 문장만 작성' },
  ],
};

export const planDocPreview = {
  title: '전환교통 보조금 사업계획서',
  formats: 'HWP · PDF',
  desc: '국토교통부 고시 제2019-16호 별지 서식을 그대로 씁니다. 추가비용과 편익을 법정 산식으로 계산해 보조금 신청액까지 채워 드립니다.',
  formNo: '[별지 제3호 서식]',
  docTitle: '「전환교통 지원사업 사업계획서」',
  benefitRows: [
    { label: '온실가스 감축', source: '환경부 배출계수', amount: '158,000,000원' },
    { label: '대기오염 저감', source: '환경부 사회적비용 단가', amount: '64,000,000원' },
    { label: '교통사고 예방', source: 'KOTI 산식', amount: '53,000,000원' },
    { label: '도로혼잡 완화', source: 'KOTI 산식', amount: '865,000,000원' },
  ],
  benefitTotal: '1,140,000,000원',
  subsidyRows: [
    { label: '추가비용 (A)', formula: '3. 추가비용 합계', amount: '415,000,000원' },
    { label: '편익 × 30% (B)', formula: '1,140,000,000 × 0.3', amount: '342,000,000원' },
  ],
  subsidyResult: { label: '보조금 신청액', formula: 'min(A, B)', amount: '342,000,000원' },
  aiParagraph:
    '본 전환을 통해 보고 기간 내 182 tCO₂eq의 온실가스를 감축하였으며, 사회환경적 편익은 총 1,140,000,000원으로 산출되었습니다.',
};

export const esgDocPreview = {
  title: 'K-ESG 지표표',
  formats: 'Scope 3 · CSV',
  desc: '지속가능경영보고서에 그대로 옮길 수 있는 항목별 표입니다. 산식과 계수 출처를 함께 표기해 검증 요청에 대응할 수 있습니다.',
  formNo: '[공시 증빙용]',
  docTitle: '「K-ESG 지표표」',
  rows: [
    { code: 'E-3-2', name: '온실가스 배출량 (Scope 3)', value: '182 tCO₂eq 감축', source: '환경부 배출계수 2026' },
    { code: 'E-7-1', name: '대기오염물질 배출량', value: 'NOx·SOx·PM2.5 저감', source: '환경부 사회적비용 단가' },
    { code: 'E-3-3', name: '온실가스 배출량 검증', value: '산식·계수 출처 명시', source: '공공 데이터 기반' },
  ],
  aiParagraph:
    '감축량과 대기오염물질 저감분은 환경부 배출계수와 사회적비용 단가를 적용해 산정하였고, 산식과 계수 출처를 함께 공개하여 검증 가능성을 확보하였습니다.',
  guideline: '공급망 실사 대응 K-ESG 가이드라인 (산업통상자원부 · 한국생산성본부) 기준',
};

/* ── 02 로그인 · 회원가입 ────────────────────────────── */

export type Role = 'corp' | 'korail';

export interface RoleOption {
  key: Role;
  label: string;
  desc: string;
  /** 데모 입장 화면에서 쓰는 짧은 설명 */
  demoDesc: string;
}

export const roles: RoleOption[] = [
  {
    key: 'corp',
    label: '기업 물류 담당자',
    desc: '화물을 등록하고 합적 매칭과 ESG 환산 성과, K-ESG 공시 리포트를 받습니다.',
    demoDesc: '화물 등록 · 합적 매칭 · ESG 환산 성과 · 보조금 신청서',
  },
  {
    key: 'korail',
    label: '코레일 담당자',
    desc: '공차 현황을 확인하고 화차 배정을 승인하며 노선별 수익을 관리합니다.',
    demoDesc: '공차 현황 · 화차 배정 승인 · 노선별 추가 수익',
  },
];

export const orgField: Record<Role, { label: string; placeholder: string }> = {
  corp: { label: '회사명', placeholder: 'embark' },
  korail: { label: '소속 본부 · 지사', placeholder: '물류사업본부' },
};

export const loginCta: Record<Role, string> = {
  corp: '로그인',
  korail: '코레일 계정으로 로그인',
};

export const signupCta: Record<Role, string> = {
  corp: '기업 담당자로 가입하기',
  korail: '코레일 담당자로 가입하기',
};
