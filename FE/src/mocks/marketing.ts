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

export const marketingNav = ['서비스 소개', '작동 방식', 'ESG 리포트', '요금'];

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
  title: '2026년 Scope 3 공시, 지금 준비하세요',
  body: '첫 화물 등록부터 리포트 발행까지 5분이면 충분합니다.',
  button: '무료로 시작하기',
};

export const landingStats = [
  { label: '누적 합적 화주', value: '128개사' },
  { label: '채운 공차', value: '1,043량' },
];

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
