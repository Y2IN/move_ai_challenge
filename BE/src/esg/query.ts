/**
 * 요청 파라미터 → 집계. #40·#41·#42 가 같은 규칙으로 기간과 대상을 해석하도록
 * 한 곳에 모읍니다. 라우트는 입력을 넘기고 결과를 그대로 응답하기만 합니다.
 */

import { loadLedger, memoAggregate } from "../db/ledger";
import { loadUniverse } from "../db/universe";
import { seed } from "../seed";
import type { SeedData } from "../types";
import { aggregate, customPeriod, parsePeriod, PeriodParseError } from "./period";
import type { EsgAggregate, EsgPeriod, LedgerData } from "./types";

export interface EsgQuery {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  shipperId?: string | null;
}

export class EsgQueryError extends Error {}

/** 기간·화주 해석만 (집계 전 공통 단계). */
function resolveQuery(
  query: EsgQuery,
  data: SeedData,
): { period: EsgPeriod; shipperId: string | null } {
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
  if (target && !data.shippers.some((s) => s.id === target)) {
    const known = data.shippers.map((s) => s.id).join(", ");
    throw new EsgQueryError(`알 수 없는 화주입니다: ${target} (가능한 값: ${known})`);
  }

  return { period: resolved, shipperId: target };
}

/**
 * `from`·`to` 가 둘 다 오면 임의 구간, 아니면 `period`, 둘 다 없으면 직전 완료 분기.
 * 모르는 화주 id 는 빈 결과 대신 에러입니다 — 오타를 "실적 0"으로 보여주면 안 됩니다.
 *
 * 번들 원장으로 집계하는 동기 버전입니다. 테스트·생성 스크립트가 이걸 씁니다.
 * 라우트는 DB 원장을 읽는 `resolveAggregateDb` 를 쓰세요.
 */
export function resolveAggregate(query: EsgQuery): EsgAggregate {
  const { period, shipperId } = resolveQuery(query, seed);
  return aggregate({ period, shipperId });
}

/**
 * DB 원장·유니버스로 집계합니다 (미연결이면 번들로 폴백 — 로더가 처리).
 * 같은 (기간, 화주) 조합은 인스턴스 캐시에서 재사용합니다.
 */
export async function resolveAggregateDb(query: EsgQuery): Promise<EsgAggregate> {
  const [data, ledger] = await Promise.all([loadUniverse(), loadLedger()]);
  const { period, shipperId } = resolveQuery(query, data);
  return memoAggregate(`${period.from}|${period.to}|${shipperId ?? "*"}`, () =>
    aggregate({ period, shipperId, ledger, data }),
  );
}

/** 이미 로드한 원장·유니버스로 집계 (여러 기간을 한 요청에서 훑을 때 왕복을 줄인다). */
export function aggregateWith(
  query: EsgQuery,
  ledger: LedgerData,
  data: SeedData,
): EsgAggregate {
  const { period, shipperId } = resolveQuery(query, data);
  return memoAggregate(`${period.from}|${period.to}|${shipperId ?? "*"}`, () =>
    aggregate({ period, shipperId, ledger, data }),
  );
}
