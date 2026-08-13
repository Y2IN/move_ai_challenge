/**
 * 대기오염물질 배출량 (K-ESG **E-7-1**).
 *
 * `calc.ts` 의 대기오염 항목은 **사회적 비용(원)** 이라 공시 지표표의 배출량 칸을
 * 채울 수 없습니다. 같은 ton·km 를 배출계수로 다시 환산해 **물리량(kg)** 을 냅니다.
 *
 * 기준선/실제 구분은 `calc.ts` 와 같습니다.
 *   기준선 = 전 구간 도로 직행
 *   실제   = 간선 철도 + 양단 셔틀(도로 계수 적용)
 */

import { AIR_POLLUTANT_G_PER_TON_KM, AIR_POLLUTANT_LABEL } from "../constants";
import type { LegVolumes } from "../types";
import type { PollutantAmount, PollutantKey } from "./types";

export const POLLUTANT_KEYS = ["nox", "sox", "pm25"] as const;

export type PollutantTotals = Record<PollutantKey, { baselineKg: number; actualKg: number }>;

export function emptyPollutantTotals(): PollutantTotals {
  return {
    nox: { baselineKg: 0, actualKg: 0 },
    sox: { baselineKg: 0, actualKg: 0 },
    pm25: { baselineKg: 0, actualKg: 0 },
  };
}

/** ton·km → 물질별 배출량(kg). g 단위 계수라 1000으로 나눕니다. */
export function computePollutants(v: LegVolumes): Record<PollutantKey, PollutantAmount> {
  const out = {} as Record<PollutantKey, PollutantAmount>;

  for (const key of POLLUTANT_KEYS) {
    const rate = AIR_POLLUTANT_G_PER_TON_KM[key];
    const baselineKg = (v.roadDirectTonKm * rate.road) / 1000;
    const actualKg = (v.railTonKm * rate.rail + v.shuttleTonKm * rate.road) / 1000;
    const reducedKg = baselineKg - actualKg;

    out[key] = {
      key,
      label: AIR_POLLUTANT_LABEL[key],
      baselineKg,
      actualKg,
      reducedKg,
      reductionRate: baselineKg > 0 ? reducedKg / baselineKg : 0,
    };
  }

  return out;
}