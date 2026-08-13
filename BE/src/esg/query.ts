/**
 * 요청 파라미터 → 집계. #40·#41·#42 가 같은 규칙으로 기간과 대상을 해석하도록
 * 한 곳에 모읍니다. 라우트는 입력을 넘기고 결과를 그대로 응답하기만 합니다.
 */

import { seed } from "../seed";
import { aggregate, customPeriod, parsePeriod, PeriodParseError } from "./period";
import type { EsgAggregate } from "./types";

export interface EsgQuery {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  shipperId?: string | null;
}

export class EsgQueryError extends Error {}

/**
 * `from`·`to` 가 둘 다 오면 임의 구간, 아니면 `period`, 둘 다 없으면 직전 완료 분기.
 * 모르는 화주 id 는 빈 결과 대신 에러입니다 — 오타를 "실적 0"으로 보여주면 안 됩니다.
 */
export function resolveAggregate(query: EsgQuery): EsgAggregate {
  const { period, from, to, shipperId } = query;

  if ((from && !to) || (!from && to)) {
    throw new EsgQueryError("from 과 to 는 함께 지정해야 합니다.");
  }

  let resolved;
  try {
    resolved = from && to ? customPeriod(from, to) : parsePeriod(period);
  } catch (error) {
    if (error instanceof PeriodParseError) throw new EsgQueryError(error.message);
    throw error;
  }

  const target = shipperId?.trim() || null;
  if (target && !seed.shippers.some((s) => s.id === target)) {
    const known = seed.shippers.map((s) => s.id).join(", ");
    throw new EsgQueryError(`알 수 없는 화주입니다: ${target} (가능한 값: ${known})`);
  }

  return aggregate({ period: resolved, shipperId: target });
}
