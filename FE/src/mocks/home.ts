export type Persona = "corp" | "korail";

export type MatchTone = "done" | "group" | "wait" | "nego" | "queue";

export interface MatchDetail {
  k: string;
  v: string;
}

export interface MatchRowData {
  id: string;
  route: string;
  /** 화차 번호. 미배정이면 '미배정' */
  wagon: string;
  sub: string;
  tons: string;
  /** 적재율 (%) */
  load: number;
  /** 운송비 표시값. 기업 뷰는 절감률, 코레일 뷰는 추가 수익 */
  saving: string;
  tone: MatchTone;
  /** 값이 있으면 펼침 대신 해당 화면으로 이동한다 */
  navTo?: string;
  detail: MatchDetail[];
}

export interface StatData {
  label: string;
  value: string;
  delta: string;
  /** 'up' 초록 · 'flat' 회색 */
  deltaTone: "up" | "flat";
}

export interface BreakdownRow {
  label: string;
  value: string;
}

export const TONE_LABEL: Record<MatchTone, string> = {
  done: "매칭 완료",
  group: "그룹핑 중 2/3",
  wait: "공차 대기",
  nego: "조율 중",
  queue: "대기 등록",
};

export interface Account {
  /** 사이드바에 소속으로 찍히는 값. 기업은 회사명, 코레일은 소속 본부 */
  company: string;
  name: string;
  /** 아바타 원형에 들어가는 성 한 글자 */
  initial: string;
}

/**
 * 페르소나별 로그인 계정.
 *
 * 홈에서 뷰를 토글하면 수치뿐 아니라 **보는 사람도 바뀐다.** 기업 담당자 화면에
 * 코레일 소속이 찍히거나 그 반대면 시연 중 바로 눈에 걸린다.
 */
export const accounts: Record<Persona, Account> = {
  corp: { company: "embark", name: "최현지", initial: "최" },
  korail: { company: "코레일 물류사업본부", name: "박예은", initial: "박" },
};

/** 페르소나 토글이 없는 화면(정산·보조금 등)의 기본 계정. */
export const account = accounts.corp;

export const period = {
  label: "2026년 2분기",
  basisNote:
    "환경부 배출 계수 · 한국교통연구원 사회적 비용 산식 기준 · 8월 12일 기준",
};

/** 사회환경적 편익 내역. 합계 11억 4,000만 원 */
export const breakdown: BreakdownRow[] = [
  { label: "온실가스 감축", value: "1억 5,800만" },
  { label: "대기오염 저감", value: "6,400만" },
  { label: "교통사고 예방", value: "5,300만" },
  { label: "도로혼잡 완화", value: "8억 6,500만" },
];

export const benefitTotal = "11억 4,000만";
export const subsidyAmount = "3억 4,200만 원";
export const subsidyAmountKrw = "₩342,000,000";
export const freightSaving = "4,500만 원";

export const corpStats: StatData[] = [
  {
    label: "온실가스 감축",
    value: "182 tCO₂eq",
    delta: "도로 단독 대비 74% 감소",
    deltaTone: "up",
  },
  {
    label: "운송비 절감",
    value: "4,500만 원",
    delta: "합적 단가 18% 인하",
    deltaTone: "up",
  },
  {
    label: "사회환경적 편익",
    value: "11억 4,000만 원",
    delta: "4대 편익 합산",
    deltaTone: "flat",
  },
  {
    label: "철도 전환율",
    value: "46.2%",
    delta: "전 분기 31.5%",
    deltaTone: "up",
  },
];

export const korailStats: StatData[] = [
  { label: "공차율", value: "18.7%", delta: "전 분기 31.2%", deltaTone: "up" },
  {
    label: "채운 화차",
    value: "128량",
    delta: "이번 분기 신규 배정",
    deltaTone: "flat",
  },
  {
    label: "추가 운송 수익",
    value: "8,700만 원",
    delta: "공차 노선 재판매분",
    deltaTone: "up",
  },
  {
    label: "신규 B2B 화주",
    value: "24개사",
    delta: "합적으로 신규 유입",
    deltaTone: "up",
  },
];

export const corpRows: MatchRowData[] = [
  {
    id: "r1",
    route: "울산 → 의왕ICD",
    wagon: "KRC-1204",
    sub: "embark 단독 · 화주 3곳 조율 중",
    tons: "1,860t",
    load: 41,
    saving: "산정 전",
    tone: "nego",
    navTo: "/matching/negotiation",
    detail: [
      { k: "조율 대상", v: "한림케미칼 · 우진산업 · 남광유화" },
      { k: "출발 예정", v: "2026.08.18 06:20 · 컨테이너 화차 12량" },
      { k: "예상 감축", v: "182 tCO₂eq" },
      { k: "예상 편익", v: "11억 4,000만 원" },
    ],
  },
  {
    id: "r2",
    route: "광양 → 오봉",
    wagon: "KRC-0871",
    sub: "삼호정밀 · 대명케미칼 2사 · 잔여 1건 모집 중",
    tons: "3,120t",
    load: 71,
    saving: "-14%",
    tone: "group",
    detail: [
      { k: "합적 파트너", v: "삼호정밀 외 1사" },
      { k: "출발 예정", v: "2026.08.21 06:10 · 유개화차 8량" },
      { k: "예상 감축", v: "134 tCO₂eq" },
      { k: "예상 편익", v: "8억 3,000만 원" },
    ],
  },
  {
    id: "r3",
    route: "부산신항 → 청주",
    wagon: "KRC-2216",
    sub: "복귀 공차 매칭 대기 · 화주 2/3 모집",
    tons: "1,640t",
    load: 38,
    saving: "-21%",
    tone: "wait",
    detail: [
      { k: "합적 파트너", v: "모집 중 (2/3)" },
      { k: "출발 예정", v: "2026.08.24 23:00 · 컨테이너 화차 6량" },
      { k: "예상 감축", v: "71 tCO₂eq" },
      { k: "예상 편익", v: "4억 4,000만 원" },
    ],
  },
  {
    id: "r4",
    route: "포항 → 부곡",
    wagon: "KRC-0433",
    sub: "동해철강 · 세아메탈 2사 합적 · 코레일 박예은 배정 승인",
    tons: "3,540t",
    load: 88,
    saving: "-16%",
    tone: "done",
    detail: [
      { k: "합적 파트너", v: "동해철강 외 1사" },
      { k: "출발", v: "2026.08.19 04:20 · 무개화차 10량" },
      { k: "탄소 감축", v: "152 tCO₂eq" },
      { k: "사회환경적 편익", v: "9억 4,000만 원" },
    ],
  },
  {
    id: "r5",
    route: "여수 → 제천",
    wagon: "KRC-1587",
    sub: "삼호정밀 · 대명케미칼 · 청우물류 3/4 모집",
    tons: "2,180t",
    load: 63,
    saving: "-12%",
    tone: "group",
    detail: [
      { k: "합적 파트너", v: "삼호정밀 외 2사" },
      { k: "출발 예정", v: "2026.08.26 19:50 · 탱크화차 5량" },
      { k: "예상 감축", v: "93 tCO₂eq" },
      { k: "예상 편익", v: "5억 8,000만 원" },
    ],
  },
  {
    id: "r6",
    route: "울산 → 부산신항",
    wagon: "미배정",
    sub: "남광유화 단독 · 부산신항 공차 대기",
    tons: "720t",
    load: 16,
    saving: "산정 전",
    tone: "queue",
    detail: [
      { k: "화주", v: "남광유화" },
      { k: "인도 조건", v: "부산신항 인수 (절대 조건)" },
      { k: "대기 사유", v: "의왕ICD 편성에서 제외" },
      { k: "다음 공차", v: "부산신항 회송 일정 확인 중" },
    ],
  },
];

export const korailRows: MatchRowData[] = [
  {
    id: "r1",
    route: "울산 → 의왕ICD",
    wagon: "KRC-1204",
    sub: "컨테이너 화차 12량 · embark 단독, 화주 3곳 조율 중",
    tons: "1,860t",
    load: 41,
    saving: "산정 전",
    tone: "nego",
    // 코레일 행은 기업 조율 화면으로 보내지 않고 인라인 펼침 (navTo 없음)
    detail: [
      { k: "조율 대상", v: "한림케미칼 · 우진산업 · 남광유화" },
      { k: "출발 예정", v: "2026.08.18 06:20" },
      { k: "공차 해소", v: "조율 중" },
      { k: "예상 수익", v: "2,400만 원" },
    ],
  },
  {
    id: "r2",
    route: "광양 → 오봉",
    wagon: "KRC-0871",
    sub: "유개화차 8량 · 잔여 용량 1,270t",
    tons: "3,120t",
    load: 71,
    saving: "+1,650만",
    tone: "group",
    detail: [
      { k: "화주", v: "삼호정밀 외 1사" },
      { k: "출발 예정", v: "2026.08.21 06:10" },
      { k: "잔여 용량", v: "1,270t" },
      { k: "예상 수익", v: "1,650만 원" },
    ],
  },
  {
    id: "r3",
    route: "부산신항 → 청주",
    wagon: "KRC-2216",
    sub: "복귀 공차 6량 · 적재 미달",
    tons: "1,640t",
    load: 38,
    saving: "기회 6량",
    tone: "wait",
    detail: [
      { k: "화주", v: "모집 중 (2/3)" },
      { k: "출발 예정", v: "2026.08.24 23:00" },
      { k: "미배정 용량", v: "2,680t" },
      { k: "잠재 수익", v: "980만 원" },
    ],
  },
  {
    id: "r4",
    route: "포항 → 부곡",
    wagon: "KRC-0433",
    sub: "무개화차 10량 · 화주 2개사",
    tons: "3,540t",
    load: 88,
    saving: "+1,980만",
    tone: "done",
    detail: [
      { k: "화주", v: "동해철강 외 1사" },
      { k: "출발", v: "2026.08.19 04:20" },
      { k: "공차 해소", v: "10량" },
      { k: "추가 수익", v: "1,980만 원" },
    ],
  },
  {
    id: "r5",
    route: "여수 → 제천",
    wagon: "KRC-1587",
    sub: "탱크화차 5량 · 잔여 용량 1,280t",
    tons: "2,180t",
    load: 63,
    saving: "+1,120만",
    tone: "group",
    detail: [
      { k: "화주", v: "삼호정밀 외 2사" },
      { k: "출발 예정", v: "2026.08.26 19:50" },
      { k: "잔여 용량", v: "1,280t" },
      { k: "예상 수익", v: "1,120만 원" },
    ],
  },
  {
    id: "r6",
    route: "울산 → 부산신항",
    wagon: "미배정",
    sub: "부산신항 회송 공차 대기 · 화주 1개사",
    tons: "720t",
    load: 16,
    saving: "배정 전",
    tone: "queue",
    detail: [
      { k: "화주", v: "남광유화" },
      { k: "인도 조건", v: "부산신항 인수 (절대 조건)" },
      { k: "대기 사유", v: "의왕ICD 편성에서 제외" },
      { k: "다음 공차", v: "부산신항 회송 일정 확인 중" },
    ],
  },
];

export const lastReport = {
  title: "2026년 1분기 리포트",
  meta: "PDF · 5월 9일",
};

/** 코레일 홈 — 좌측 hero (기업 보조금 카드 자리). 공차율이 주인공 */
export const korailHero = {
  label: '이번 분기 공차율',
  badge: '12.5%p 개선',
  value: '18.7%',
  sub: '전 분기 31.2%',
  drivers: [
    { label: '채운 화차', value: '128량' },
    { label: '재판매 공차 노선', value: '34개' },
    { label: '신규 B2B 화주', value: '24개사' },
  ],
  revenueLabel: '추가 운송 수익',
  revenue: '8,700만 원',
};

/** 코레일 홈 — 좌측 2번째 카드 (기업 '운송비 절감' 자리) */
export const korailPotential = {
  label: '미배정 공차 잠재 수익',
  note: '적재 미달 공차 3편성 채우면',
  value: '2,340만 원',
};

/** 코레일 홈 — 하단 우측 카드 (기업 'K-ESG 리포트' 자리) */
export const korailReportCard = {
  title: '수송 실적 리포트',
  body: '이번 분기 공차율·재판매 수익 실적을 리포트로 정리합니다.',
  button: '실적 리포트 보기',
  to: '/korail/performance', // 아직 없는 화면. 버튼만 걸어둠
};

/** 헤더 버튼·섹션 제목 persona 분기 */
export const homeCopy = {
  corp: {
    primaryBtn: { label: '화물 등록', to: '/freight/new' },
    matchTitle: 'AI 합적 매칭 현황',
  },
  korail: {
    primaryBtn: { label: '공차 관리', to: '/korail/wagons' }, // 아직 없는 화면
    matchTitle: '공차 편성 현황',
  },
} as const;
