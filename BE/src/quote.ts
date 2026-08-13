/**
 * 견적 — "지금 등록하면 얼마인가"에 답한다.
 *
 * 화차 간선운임은 **적재량과 무관하게 고정**이라, 톤당 단가는 최종적으로 몇 톤이
 * 모이느냐에 달려 있다. 18톤 화차에 6톤만 실으면 만재 대비 3배를 낸다.
 * 그런데 화주가 등록하는 시점에는 그걸 알 수가 없다.
 *
 * 그래서 세 값을 함께 준다.
 *   현재가  지금 편성된 물량으로 확정했을 때
 *   최선가  정원까지 다 찼을 때
 *   상한    화주가 지금 내고 있는 도로 운임 — **이걸 절대 넘기지 않는다**
 *
 * 상한을 보장하면 화주는 최악을 알고 바로 결정할 수 있고, 많이 모일수록 자기가
 * 싸지므로 다른 화주를 데려올 유인이 생긴다.
 *
 * ⚠️ 마감 시점의 상태 판정(`open`/`cutoff`/`confirmed`/`cancelled`)은 여기 없다.
 *    `matching.ts` 의 상태 머신으로 들어가야 하며 계산 담당 몫이다.
 */

import { allocate, computeCost, type CalcInput, type MemberInput } from "./calc";
import type { EmptyWagon, MemberShare } from "./types";

export interface QuoteLine {
  /** 이 시나리오에서의 편성 총 물량 */
  totalTon: number;
  loadRate: number;
  /** 견적을 요청한 화주의 분담액 */
  share: MemberShare | null;
}

export interface Quote {
  wagonId: string;
  capacityTon: number;
  cutoffAt: string;
  /** 마감까지 남은 시간(시간 단위). 음수면 이미 마감 */
  hoursToCutoff: number;
  shortfallTon: number;
  /** 지금 확정하면 */
  current: QuoteLine;
  /** 정원까지 찼을 때 */
  best: QuoteLine;
  /** 절대 넘기지 않는 금액 = 화주의 현재 도로 운임 */
  capKrw: number;
  /** 최선가 대비 현재가가 얼마나 비싼지 */
  upsideKrw: number;
  message: string;
}

/**
 * @param target       견적을 받는 화주 (아직 편성에 안 들어갔어도 됨)
 * @param others       이미 편성에 잡혀 있는 다른 화주들
 * @param wagon        대상 화차
 * @param base         거리·정원 등 편성 공통 정보
 * @param now          기준 시각 (테스트에서 고정하기 위해 주입)
 */
export function quote(
  target: MemberInput,
  others: MemberInput[],
  wagon: EmptyWagon,
  base: Omit<CalcInput, "totalTon" | "memberCount" | "members">,
  now: Date = new Date(),
): Quote {
  const line = (members: MemberInput[]): QuoteLine => {
    const totalTon = members.reduce((a, m) => a + m.weightTon, 0);
    // 셔틀 거리는 멤버 구성에 따라 달라진다. base 값을 그대로 쓰면 편성 합계
    // 셔틀비와 화주별 셔틀비가 어긋난다.
    const shuttleDistanceKm =
      totalTon > 0
        ? members.reduce((a, m) => a + m.shuttleKm * m.weightTon, 0) / totalTon
        : base.shuttleDistanceKm;
    const input: CalcInput = {
      ...base,
      shuttleDistanceKm,
      totalTon,
      memberCount: members.length,
      members,
      actualRoadFareKrw: members.reduce((a, m) => a + m.currentRoadFareKrw, 0) || undefined,
    };
    const shares = allocate(members, computeCost(input), input);
    return {
      totalTon,
      loadRate: totalTon / wagon.capacityTon,
      share: shares.find((s) => s.shipmentId === target.shipmentId) ?? null,
    };
  };

  const withTarget = [...others, target];
  const current = line(withTarget);

  // 정원까지 채웠다고 가정 — 남는 자리를 가상 화주로 메운다.
  // 셔틀 거리는 기존 화주 평균을 쓴다 (누가 올지 모르므로).
  const shortfallTon = Math.max(0, wagon.capacityTon - current.totalTon);
  const avgShuttle =
    withTarget.reduce((a, m) => a + m.shuttleKm * m.weightTon, 0) /
    Math.max(1, current.totalTon);

  const best =
    shortfallTon > 0
      ? line([
          ...withTarget,
          {
            shipmentId: "__filler__",
            shipperName: "추가 합류 예상",
            weightTon: shortfallTon,
            shuttleKm: avgShuttle,
            currentRoadFareKrw: 0,
          },
        ])
      : current;

  const hoursToCutoff = wagon.cutoffAt
    ? (new Date(wagon.cutoffAt).getTime() - now.getTime()) / 3_600_000
    : Number.NaN;

  const currentKrw = current.share?.billedKrw ?? 0;
  const bestKrw = best.share?.billedKrw ?? currentKrw;

  return {
    wagonId: wagon.id,
    capacityTon: wagon.capacityTon,
    cutoffAt: wagon.cutoffAt,
    hoursToCutoff,
    shortfallTon,
    current,
    best,
    capKrw: target.currentRoadFareKrw,
    upsideKrw: Math.max(0, currentKrw - bestKrw),
    message:
      shortfallTon > 0
        ? `현재 ${current.totalTon}톤 / 정원 ${wagon.capacityTon}톤. ${shortfallTon}톤이 더 모이면 ${(currentKrw - bestKrw).toLocaleString("ko-KR")}원 더 내려갑니다.`
        : `정원이 모두 찼습니다. 최선가로 확정됩니다.`,
  };
}
