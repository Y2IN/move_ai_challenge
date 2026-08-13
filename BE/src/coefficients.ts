/**
 * 계수 노출 (#29 GET /api/coefficients) — constants.ts 의 값을 구조화해 돌려준다.
 *
 * 계수는 매년 고시로 바뀌고 신청서에 "출처"를 명시해야 하므로, 계산 결과에 박히는
 * `version` 을 함께 준다. (실제 계수 정의는 constants.ts 한 곳에만 있다.)
 */

import * as C from "./constants";

export function getCoefficients() {
  return {
    version: C.COEFFICIENT_VERSION,
    verified: C.VERIFIED,
    sources: C.SOURCES,
    co2GPerTonKm: C.CO2_G_PER_TON_KM,
    airPollutantGPerTonKm: C.AIR_POLLUTANT_G_PER_TON_KM,
    airPollutantLabel: C.AIR_POLLUTANT_LABEL,
    socialCostKrwPerTonKm: C.SOCIAL_COST_KRW_PER_TON_KM,
    carbonPriceKrwPerTon: C.CARBON_PRICE_KRW_PER_TON,
    carbonPriceInUse: C.CARBON_PRICE_IN_USE,
    fareKrwPerTonKm: C.FARE_KRW_PER_TON_KM,
    shuttleFareMultiplier: C.SHUTTLE_FARE_MULTIPLIER,
    handlingKrwPerTon: C.HANDLING_KRW_PER_TON,
    emptyWagonDiscountRate: C.EMPTY_WAGON_DISCOUNT_RATE,
    subsidy: C.SUBSIDY,
    pineCo2KgPerTreeYear: C.PINE_CO2_KG_PER_TREE_YEAR,
    truckCapacityTon: C.TRUCK_CAPACITY_TON,
  };
}
