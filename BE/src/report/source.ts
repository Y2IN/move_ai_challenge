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
import type { MatchResult } from "../matching";
import { seed } from "../seed";
import type { ShipmentInput } from "../types";
import { latestConfirmation } from "../store";
import { buildReportInput } from "./adapter";
import type { Applicant, ReportInput, ReportPeriod } from "./contract";
import { fixtureReportInput } from "./fixture";

/** 시연용 신청인. 계정 기능이 붙으면 세션에서 가져온다. */
export const DEMO_APPLICANT: Applicant = {
  name: "embark 주식회사",
  bizNo: "111-11-11111",
  ceo: "제예인",
  manager: "최현지",
  phone: "02-6000-1234",
  address: "서울특별시 oorn oo동",
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
 *
 * ⚠️ **확정된 편성(#19)이 있으면 그걸 먼저 쓴다.**
 *
 *    예전에는 매번 `match(seed, ...)` 를 다시 돌렸다. 그런데 시연 시나리오는
 *    일부러 정원 미달(14/18톤)이라 항상 shortfall 이 나왔고, 조율로 편성을
 *    살려 확정(GRP-NNN)해도 보고서는 그 사실을 영영 모른 채 fixture 로 떨어졌다.
 *    "조율 → 확정 → 보고서" 가 이 제품의 핵심 흐름인데 마지막 고리가 끊겨 있었다.
 */
export async function resolveReportInput(opts: ResolveOptions = {}): Promise<ReportSource> {
  try {
    // 1) 확정된 편성이 있으면 그 실적으로 만든다.
    const confirmed = await latestConfirmation();
    if (confirmed?.calc) {
      // 서식에 인쇄할 노선명이 lane 에서 나오므로 화차의 laneId 로 되찾는다.
      const lane = seed.lanes.find((l) => l.id === confirmed.wagon.laneId) ?? null;
      const asMatch: MatchResult = {
        status: "matched",
        phase: "confirmed",
        hoursToCutoff: 0,
        wagon: confirmed.wagon,
        lane,
        members: confirmed.members,
        totalTon: confirmed.totalTon,
        capacityTon: confirmed.capacityTon,
        loadFactor: confirmed.loadFactor,
        shortfallTon: 0,
        negotiationCandidates: [],
        calc: confirmed.calc,
        message: `${confirmed.groupId} 확정 편성`,
      };

      return {
        input: buildReportInput(
          [{ match: asMatch, trips: opts.trips ?? 12 }],
          opts.applicant ?? DEMO_APPLICANT,
          opts.period ?? DEMO_PERIOD,
          seed.stations,
        ),
        origin: "live",
      };
    }

    // 2) 확정이 없으면 지금 입력으로 매칭해 본다.
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
