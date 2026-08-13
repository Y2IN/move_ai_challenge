/**
 * 리포트 입력을 어디서 가져올지 한 곳에서 정한다.
 *
 * 계산이 아직 확정되지 않았으므로 두 경로를 모두 둔다.
 *   live     실제 매칭·계산을 돌려서 만든 값
 *   fixture  엔진 출력을 굳혀 둔 고정 값 (계산이 죽어도 리포트 시연이 가능)
 *
 * **시연 중 계산 쪽이 터져도 리포트는 살아야 한다.** live 가 실패하면 조용히
 * fixture 로 떨어지고, 응답에 어느 쪽을 썼는지 표시한다.
 */

import { match } from "../matching";
import { seed } from "../seed";
import type { ShipmentInput } from "../types";
import { buildReportInput } from "./adapter";
import type { Applicant, ReportInput, ReportPeriod } from "./contract";
import { fixtureReportInput } from "./fixture";

/** 시연용 신청인. 계정 기능이 붙으면 세션에서 가져온다. */
export const DEMO_APPLICANT: Applicant = {
  name: "대성물산 주식회사",
  bizNo: "220-81-04512",
  ceo: "이대성",
  manager: "김철도",
  phone: "02-6000-1234",
  address: "울산광역시 남구 여천로 217",
};

export const DEMO_PERIOD: ReportPeriod = {
  from: "2026-04-01",
  to: "2026-06-30",
  label: "2026년 2분기",
};

export interface ReportSource {
  input: ReportInput;
  origin: "live" | "fixture";
  /** fixture 로 떨어진 이유 */
  reason?: string;
}

export interface ResolveOptions {
  shipment?: ShipmentInput | null;
  /** 같은 편성이 분기 중 반복 수송된 횟수 */
  trips?: number;
  applicant?: Applicant;
  period?: ReportPeriod;
  now?: Date;
}

/**
 * 실제 계산으로 `ReportInput` 을 만든다. 실패하면 fixture 로 떨어진다.
 *
 * 편성이 성립하지 않은 상태(shortfall)로는 사업계획서를 만들 수 없다.
 * 확정된 실적만 서식에 들어가야 하기 때문이다.
 */
export function resolveReportInput(opts: ResolveOptions = {}): ReportSource {
  try {
    const result = match(seed, opts.shipment ?? null, opts.now ?? new Date());

    if (result.status !== "matched" || !result.calc) {
      return {
        input: fixtureReportInput,
        origin: "fixture",
        reason: `편성이 확정되지 않아(${result.status}) 실적을 집계할 수 없습니다: ${result.message}`,
      };
    }

    return {
      input: buildReportInput(
        [{ match: result, trips: opts.trips ?? 12 }],
        opts.applicant ?? DEMO_APPLICANT,
        opts.period ?? DEMO_PERIOD,
        seed.stations,
      ),
      origin: "live",
    };
  } catch (e) {
    return {
      input: fixtureReportInput,
      origin: "fixture",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
