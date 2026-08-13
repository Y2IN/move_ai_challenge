/**
 * 모든 계수는 이 파일에만 둡니다. 계산 로직(BE/src/calc.ts)에 숫자를 직접 쓰지 않습니다.
 * 심사 중 수치 교체 요구가 들어와도 여기 한 곳만 고치면 전체가 갱신됩니다.
 *
 * ⚠️ VERIFIED: false 인 값은 아직 1차 출처를 확인하지 않은 추정치입니다.
 *    발표 전 SOURCES 의 원문을 캡처해서 docs/ 에 남기고 값을 교체하세요.
 */

export const VERIFIED = false as const;

export const SOURCES = {
  co2: "국토교통부 수송수단별 온실가스 배출원단위 / 국가온실가스 인벤토리",
  socialCost: "한국교통연구원(KOTI) 「교통시설 투자평가지침」",
  kau: "한국거래소 배출권시장 KAU 종가",
  fare: "코레일 화물운임표 / 화물자동차 운임 실태조사",
  pine: "산림청 주요 수종별 CO₂ 흡수량",
  subsidy: "지속가능 교통물류 발전법 제21조 · 국토교통부 고시 제2019-16호",
} as const;

// ── 온실가스 배출원단위 (g-CO₂eq / ton·km) ─────────────────────
// 디자인 문서의 도로 246 tCO₂ / 4,280톤 · 359km 를 역산하면 160.1 g/ton·km 로,
// 아래 도로 계수와 일치합니다. 철도 계수는 디자인이 셔틀분을 섞어 계산해
// 41.7 g/ton·km 로 보이지만, 간선만 분리하면 23 g/ton·km 입니다.
export const CO2_G_PER_TON_KM = {
  road: 160.1,
  rail: 23.0,
} as const;

// ── 사회적 비용 원단위 (원 / ton·km) ───────────────────────────
// ⚠️ 추정치. KOTI 지침 원문 표로 교체 필요.
export const SOCIAL_COST_KRW_PER_TON_KM = {
  airPollution: { road: 6.5, rail: 0.8 },
  accident: { road: 11.0, rail: 0.3 },
  congestion: { road: 28.0, rail: 0.0 },
  roadWear: { road: 5.5, rail: 0.5 },
} as const;

/** 온실가스 금전 환산 단가 (원 / tCO₂eq) */
export const CARBON_PRICE_KRW_PER_TON = {
  /** 배출권 시세 — 실제로 거래되는 가격. 보수적이고 방어하기 쉽습니다. */
  kau: 9_000,
  /** 사회적 탄소비용 — 공공사업 편익 산정에 쓰는 그림자가격. 보조금 산정에는 이쪽이 맞습니다. */
  socialCostOfCarbon: 50_000,
} as const;

/** 편익 산정에 실제로 쓸 단가. 전환교통 보조금은 '사회환경적 편익' 기준이므로 SCC. */
export const CARBON_PRICE_IN_USE = CARBON_PRICE_KRW_PER_TON.socialCostOfCarbon;

// ── 운임 원단위 (원 / ton·km) ──────────────────────────────────
export const FARE_KRW_PER_TON_KM = {
  /** 대형 트럭 만재 기준 간선 도로 운임 */
  road: 118,
  /** 코레일 화물 간선 운임 */
  railLineHaul: 78,
} as const;

/** 양단 셔틀(공장↔역)은 단거리라 톤·km 단가가 간선보다 비쌉니다. */
export const SHUTTLE_FARE_MULTIPLIER = 1.6;

/** 상하역비 (원 / 톤, 양단 합계) */
export const HANDLING_KRW_PER_TON = 12_000;

/** 복귀 공차에 실을 때 받는 간선 운임 할인율 */
export const EMPTY_WAGON_DISCOUNT_RATE = 0.15;

/**
 * 최저톤수 제도 — 코레일 화물운임은 화차 1량당 '화차표기하중톤수'를 최저톤수로 부과합니다.
 * 6톤만 실어도 18톤 화차를 잡으면 18톤 요금을 냅니다.
 *
 * 이것이 소량 화주가 철도를 쓰지 못하는 진짜 이유이고, 합적이 만드는 절감의 정체입니다.
 * 합적 전 = 화주 N명이 각자 화차 1량씩 → 최저톤수 N번
 * 합적 후 = 1량에 N명 → 최저톤수 1번 + 복귀 공차 할인
 */
export const MIN_BILLABLE_LOAD_RATIO = 1.0;

// ── 전환교통 보조금 (국토교통부 고시 제2019-16호) ──────────────
export const SUBSIDY = {
  /** 보조금 = min(전환 추가비용, 사회환경적 편익 × 이 비율) */
  benefitCapRate: 0.3,
  /** 기업 구분별 가점 — ⚠️ 고시 원문 확인 필요 */
  gradeBonus: { sme: 0.05, excellentLogistics: 0.03, general: 0 },
} as const;

// ── 환산 표현 ──────────────────────────────────────────────────
/** 소나무 1그루 연간 CO₂ 흡수량 (kg) — 산림청 30년생 기준 */
export const PINE_CO2_KG_PER_TREE_YEAR = 6.6;

/** 대형 화물차 1대 적재량 (톤) — "트럭 N대 감소" 환산용 */
export const TRUCK_CAPACITY_TON = 25;