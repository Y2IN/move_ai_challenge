/**
 * 홈 화면의 **카피**와 로그인 계정.
 *
 * 수치는 전부 API 로 넘어갔습니다 — KPI·매칭 목록·보조금 예상액은 `lib/dashboard.ts`
 * (#7·#8·#9)를 쓰세요. 여기 남은 건 API 가 주지 않는 문구와, 인증(#1~#5)이 MVP
 * 범위 밖이라 서버에서 받을 수 없는 계정 표시값뿐입니다.
 */

/*
 * 계정 표시값(회사명·담당자)은 **#4 `/api/me`** 에서 옵니다 — `lib/account.ts`.
 * 인증(#1~#5)이 MVP 밖이라 서버가 시드 값을 돌려주지만, 화면에 상수로 두지는
 * 않습니다. 인증이 붙는 날 그 상수를 찾아 지우는 일부터 하게 되기 때문입니다.
 */

/** 편익 산정 근거 — 계수 출처 문구. 값이 아니라 산식의 출처라 화면 카피입니다. */
export const basisNote = '환경부 배출계수 · 한국교통연구원 사회적 비용 산식 기준';

/** 헤더 버튼·섹션 제목 persona 분기 */
export const homeCopy = {
  corp: {
    primaryBtn: { label: '화물 등록', to: '/freight/new' },
    matchTitle: 'AI 합적 매칭 현황',
    heroLabel: '이번 분기 전환교통 보조금 예상액',
    savingLabel: '운송비 절감 (보조금과 별개)',
    savingNote: '합적 단가 인하분',
  },
  korail: {
    primaryBtn: { label: '공차 관리', to: '/korail/wagons' },
    matchTitle: '공차 편성 현황',
    heroLabel: '이번 분기 공차율',
    savingLabel: '모집 중 공차',
    savingNote: '최소 적재 기준에 못 미쳐 채울 여지가 있는 편성',
  },
} as const;

/** 우측 하단 카드 — 기업은 리포트 생성, 코레일은 실적 리포트로 보냅니다. */
export const reportCard = {
  corp: {
    title: 'K-ESG 공시 리포트',
    body: '이번 분기 지표로 전환교통 보조금 신청서와 K-ESG 지표표를 만듭니다.',
    button: '신청서 만들기',
    to: '/subsidy/new',
  },
  korail: {
    title: '수송 실적 리포트',
    body: '이번 분기 공차율·재판매 수익 실적을 리포트로 정리합니다.',
    button: '실적 리포트 보기',
    to: '/korail/performance',
  },
} as const;
