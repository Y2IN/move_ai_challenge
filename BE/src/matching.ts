/**
 * 합적 매칭 — 시드 화물 풀 + 사용자가 방금 등록한 화물을 합쳐서 편성을 만듭니다.
 *
 * 화면(디자인 04a)에서 사용자가 화물을 등록할 때마다 이 함수를 다시 돌립니다.
 * 입력이 바뀌면 편성 → 편익 → 보조금이 전부 다시 계산됩니다.
 *
 * 알고리즘은 그리디(무거운 것부터 채우기)로 충분합니다. 최적화에 과투자하지 마세요.
 */

import { calculate, type CalcInput } from "./calc";
import type {
  CalcResult,
  EmptyWagon,
  ItemCategory,
  Lane,
  SeedData,
  Shipment,
  ShipmentInput,
} from "./types";

export interface MatchCandidate {
  shipmentId: string;
  shipperName: string;
  weightTon: number;
  description: string;
  /** 화물 등록 폼(04a)의 품목 셀렉트 값. 서식 2. 전환 계획 표에 인쇄된다 */
  category: ItemCategory;
  /** 사용자가 방금 등록한 화물이면 true */
  isUserInput: boolean;
  /** 조율(양보)이 있어야 실을 수 있는 화물이면 그 이유 */
  requiresNegotiation: string | null;
}

/**
 * 모집 마감 기준 편성 상태.
 *
 * 화주는 한날 한시에 등록하지 않는다. 그래서 "지금 몇 톤인가"만으로는 성립 여부를
 * 판단할 수 없고, **마감시한(cutoffAt)** 이 있어야 한다.
 *
 *   open       모집 중. 아직 더 모일 수 있다
 *   negotiate  마감 임박인데 정원 미달 → **조율 에이전트 발동 지점**
 *   confirmed  최소 적재율 이상으로 성립
 *   cancelled  마감했는데 최소 적재율 미달 → 취소, 다음 화차로 이월 (과금 없음)
 */
export type WagonPhase = "open" | "negotiate" | "confirmed" | "cancelled";

/** 마감 몇 시간 전부터 조율 에이전트를 돌릴지 */
export const NEGOTIATION_WINDOW_HOURS = 48;

export interface MatchResult {
  /**
   * `phase` 에서 파생됩니다. 둘이 따로 놀면 "phase=confirmed 인데 status=shortfall,
   * calc=null" 같은 자기모순이 API 로 나갑니다.
   *   confirmed → matched   (calc 채워짐)
   *   cancelled → cancelled (마감 후 최소 적재율 미달)
   *   그 외      → shortfall (모집 중 · 조율 중)
   */
  status: "matched" | "shortfall" | "cancelled" | "noWagon";
  /** 마감 기준 상태. 시각을 넘기지 않으면 "open" 취급 */
  phase: WagonPhase;
  /** 마감까지 남은 시간. 음수면 이미 마감 */
  hoursToCutoff: number;
  wagon: EmptyWagon | null;
  lane: Lane | null;
  members: MatchCandidate[];
  totalTon: number;
  capacityTon: number;
  loadFactor: number;
  /** 정원까지 모자란 톤수. 0보다 크면 매칭 실패 → 조율 에이전트로 넘어갑니다. */
  shortfallTon: number;
  /** 조율로 끌어올 수 있는 후보 (status: scheduled) */
  negotiationCandidates: MatchCandidate[];
  calc: CalcResult | null;
  message: string;
}

/**
 * 마감 시각과 적재율로 편성 상태를 판정한다.
 *
 * 여기서 조율 에이전트의 **발동 조건**이 정해진다. 마감이 없으면
 * "정원 미달이면 협상"이라는 규칙은 언제 판정하는지가 없어서 성립하지 않는다.
 */
export function wagonPhase(
  wagon: EmptyWagon | null,
  totalTon: number,
  now: Date = new Date(),
): { phase: WagonPhase; hoursToCutoff: number } {
  if (!wagon || !wagon.cutoffAt) return { phase: "open", hoursToCutoff: Number.NaN };

  const hoursToCutoff =
    (new Date(wagon.cutoffAt).getTime() - now.getTime()) / 3_600_000;
  const loadRate = wagon.capacityTon > 0 ? totalTon / wagon.capacityTon : 0;

  // 마감 전 — **정원 100%** 를 요구한다. 아직 더 모을 시간이 있는데
  // minLoadRate 만 넘겼다고 확정하면 화차를 덜 채운 채 출발시키게 된다.
  // 마감 후에는 더 기다릴 수 없으므로 minLoadRate 로 완화한다(아래).
  if (hoursToCutoff > 0) {
    if (loadRate >= 1) return { phase: "confirmed", hoursToCutoff };
    if (hoursToCutoff <= NEGOTIATION_WINDOW_HOURS) {
      return { phase: "negotiate", hoursToCutoff };
    }
    return { phase: "open", hoursToCutoff };
  }

  // 마감 후 — 최소 적재율을 넘겼는지로 갈린다
  return {
    phase: loadRate >= wagon.minLoadRate ? "confirmed" : "cancelled",
    hoursToCutoff,
  };
}

/** 사용자 입력을 Shipment 형태로 정규화. 빠진 값은 시드 기준으로 추정합니다. */
export function normalizeInput(input: ShipmentInput, seed: SeedData): Shipment {
  const lane = findLane(seed, input.originStationId, input.destStationId);
  const shuttleIn = input.originShuttleKm ?? 10;
  const shuttleOut = input.destShuttleKm ?? 25;
  const roadKm = lane?.roadDistanceKm ?? 380;

  return {
    id: "SHM-USER-001",
    shipperId: "SHP-USER",
    shipperName: input.shipperName ?? "내 화물",
    status: "requested",
    cargo: {
      description: `${input.category} ${input.weightTon}톤`,
      category: input.category,
      weightTon: input.weightTon,
      volumeCbm: input.weightTon * 2.4,
      packaging: "pallet",
      hazmat: false,
      requiresCover: input.requiresCover ?? false,
      requiresRefrigeration: false,
    },
    origin: {
      name: input.shipperName ? `${input.shipperName} 출하지` : "출하지",
      address: "",
      stationId: input.originStationId,
      shuttleKm: shuttleIn,
    },
    destination: {
      name: "도착지",
      address: "",
      stationId: input.destStationId,
      shuttleKm: shuttleOut,
    },
    schedule: {
      requestedDepartureDate: input.desiredDepartureDate,
      requiredArrivalBy: input.requiredArrivalBy ?? input.desiredDepartureDate,
    },
    currentMode: "road",
    roadDirectDistanceKm: roadKm,
    currentRoadFareKrw: input.currentRoadFareKrw ?? 0,
    constraintText: input.constraintText ?? "",
    parsedConstraints: null,
    fallbackHints: {
      departureFlexDays: 0,
      hardArrivalBy: input.requiredArrivalBy ?? null,
      mustBeCovered: input.requiresCover ?? false,
      noWeekendDispatch: false,
      requiresForklift: false,
    },
  };
}

function findLane(seed: SeedData, originStationId: string, destStationId: string) {
  return (
    seed.lanes.find(
      (l) => l.originStationId === originStationId && l.destStationId === destStationId,
    ) ?? null
  );
}

function toCandidate(s: Shipment, seed: SeedData, isUserInput: boolean): MatchCandidate {
  const shipper = seed.shippers.find((sp) => sp.id === s.shipperId);
  return {
    shipmentId: s.id,
    shipperName: isUserInput ? "내 화물" : (shipper?.name ?? s.shipperId),
    weightTon: s.cargo.weightTon,
    description: s.cargo.description,
    category: s.cargo.category,
    isUserInput,
    requiresNegotiation: null,
  };
}

/** 화차가 화물의 물리 요건을 만족하는지 */
export function wagonViolation(wagon: EmptyWagon, shipments: Shipment[]): string | null {
  const needsCover = shipments.some((s) => s.cargo.requiresCover);
  if (needsCover && wagon.wagonType === "open") {
    return "우천 노출 불가 화물이 포함되어 무개화차에는 실을 수 없습니다.";
  }
  const needsForklift = shipments.some((s) => s.fallbackHints.requiresForklift);
  if (needsForklift && !wagon.handling.includes("forklift")) {
    return "지게차 하역이 필요한 화물이 포함되어 있습니다.";
  }
  return null;
}

/** 출발일이 화차 시각표와 맞는지 (fallbackHints 기준 — Claude 파싱 실패 시 경로) */
export function scheduleFits(s: Shipment, wagon: EmptyWagon): boolean {
  const want = new Date(s.schedule.requestedDepartureDate).getTime();
  const dep = new Date(wagon.departure.date).getTime();
  const flexMs = Math.abs(s.fallbackHints.departureFlexDays) * 86_400_000;
  if (Math.abs(dep - want) > flexMs) return false;

  if (s.fallbackHints.noWeekendDispatch) {
    const day = new Date(wagon.departure.date).getUTCDay();
    if (day === 0 || day === 6) return false;
  }
  const arriveBy = s.fallbackHints.hardArrivalBy;
  if (arriveBy && new Date(wagon.arrival.date).getTime() > new Date(arriveBy).getTime()) {
    return false;
  }
  return true;
}

/**
 * 시드 풀 + 사용자 입력으로 최적 편성을 찾습니다.
 * 사용자 화물은 항상 편성에 포함되고, 나머지를 그리디로 채웁니다.
 */
export function match(
  seed: SeedData,
  input: ShipmentInput | null,
  now: Date = new Date(),
): MatchResult {
  const userShipment = input ? normalizeInput(input, seed) : null;
  const pool = seed.shipments.filter((s) => s.status === "requested");
  const all = userShipment ? [userShipment, ...pool] : pool;

  const originId = userShipment?.origin.stationId ?? pool[0]?.origin.stationId;
  const destId = userShipment?.destination.stationId ?? pool[0]?.destination.stationId;
  const lane = originId && destId ? findLane(seed, originId, destId) : null;

  // 노선이 맞는 화차 후보를 훑어서 가장 많이 싣는 편성을 고릅니다.
  const wagons = seed.emptyWagons.filter((w) => !lane || w.laneId === lane.id);
  let best: { wagon: EmptyWagon; members: Shipment[] } | null = null;

  for (const wagon of wagons) {
    const eligible = all.filter((s) => scheduleFits(s, wagon));

    const members: Shipment[] = [];
    let load = 0;

    // 이미 확보된 물량(reservedTon)만큼 실제로 쓸 수 있는 자리가 줄어듭니다.
    const usableTon = Math.max(0, wagon.capacityTon - (wagon.reservedTon ?? 0));

    const seat = (s: Shipment) => {
      if (load + s.cargo.weightTon > usableTon) return;
      if (wagonViolation(wagon, [...members, s])) return; // 물리 요건 위반이면 건너뜀
      members.push(s);
      load += s.cargo.weightTon;
    };

    // 사용자가 방금 등록한 화물을 먼저 앉힙니다.
    // 무거운 것부터 그리디로 채우면 사용자 화물이 밀려나 편성에서 빠집니다.
    const mine = eligible.find((s) => s.id === userShipment?.id);
    if (mine) seat(mine);

    // 남은 자리를 무거운 것부터 채웁니다.
    for (const s of eligible
      .filter((s) => s.id !== mine?.id)
      .sort((a, b) => b.cargo.weightTon - a.cargo.weightTon)) {
      seat(s);
    }

    // 사용자 화물이 안 들어간 편성은 의미 없음
    if (userShipment && !members.some((m) => m.id === userShipment.id)) continue;
    if (!best || load > best.members.reduce((a, m) => a + m.cargo.weightTon, 0)) {
      best = { wagon, members };
    }
  }

  if (!best || best.members.length === 0) {
    return {
      status: "noWagon",
      phase: "open",
      hoursToCutoff: Number.NaN,
      wagon: null,
      lane,
      members: [],
      totalTon: 0,
      capacityTon: 0,
      loadFactor: 0,
      shortfallTon: 0,
      negotiationCandidates: [],
      calc: null,
      message: "조건에 맞는 공차가 없습니다. 출발일을 넓히거나 다른 노선을 확인하세요.",
    };
  }

  const { wagon, members } = best;
  const totalTon = members.reduce((a, m) => a + m.cargo.weightTon, 0);
  const shortfallTon = Math.max(0, wagon.capacityTon - totalTon);

  // 조율 후보 — 아직 접수 전이지만 당겨올 수 있는 예정 물량
  const negotiationCandidates = seed.shipments
    .filter((s) => s.status === "scheduled" && s.pullForwardEligible)
    .map((s) => {
      const c = toCandidate(s, seed, false);
      c.requiresNegotiation = `${s.schedule.requestedDepartureDate} 예정 물량을 ${wagon.departure.date} 편성으로 당겨야 합니다.`;
      return c;
    });

  const memberCandidates = members.map((m) =>
    toCandidate(m, seed, m.id === userShipment?.id),
  );

  const phaseInfo = wagonPhase(wagon, totalTon, now);

  // 편성 성립 여부는 **phase** 가 정합니다. 정원 100% 를 따로 요구하지 않습니다.
  // 마감 후 최소 적재율만 넘겨도 성립하므로, 그때는 계산까지 채워서 내보냅니다.
  if (phaseInfo.phase !== "confirmed") {
    return {
      status: phaseInfo.phase === "cancelled" ? "cancelled" : "shortfall",
      ...phaseInfo,
      wagon,
      lane,
      members: memberCandidates,
      totalTon,
      capacityTon: wagon.capacityTon,
      loadFactor: totalTon / wagon.capacityTon,
      shortfallTon,
      negotiationCandidates,
      calc: null,
      message: shortfallMessage(members.length, totalTon, wagon, shortfallTon, now),
    };
  }

  return {
    status: "matched",
    ...phaseInfo,
    wagon,
    lane,
    members: memberCandidates,
    totalTon,
    capacityTon: wagon.capacityTon,
    loadFactor: totalTon / wagon.capacityTon,
    shortfallTon: 0,
    negotiationCandidates,
    calc: buildCalc(members, wagon, lane, seed),
    message: `동일 노선 ${members.length}건 · ${wagon.label} 배정 완료 · 적재율 ${Math.round((totalTon / wagon.capacityTon) * 100)}%`,
  };
}

function shortfallMessage(
  count: number,
  totalTon: number,
  wagon: EmptyWagon,
  shortfallTon: number,
  now: Date,
): string {
  const { phase, hoursToCutoff } = wagonPhase(wagon, totalTon, now);
  const base = `동일 노선 ${count}건 감지. 합계 ${totalTon}톤 / 정원 ${wagon.capacityTon}톤 — ${shortfallTon}톤 부족`;

  if (phase === "cancelled") {
    return `${base}. 마감했으나 최소 적재율(${Math.round(wagon.minLoadRate * 100)}%)에 못 미쳐 편성이 취소됩니다. 과금 없이 다음 화차로 이월됩니다.`;
  }
  // 마감 시각이 없거나(NaN) 이미 지난(음수) 경우 "N시간 남음"을 인쇄하면 안 됩니다.
  const remain = Number.isFinite(hoursToCutoff)
    ? Math.floor(hoursToCutoff)
    : null;
  if (remain === null) return `${base}. 마감 시각이 지정되지 않았습니다.`;
  if (remain <= 0) return `${base}. 모집이 마감되었습니다.`;

  return phase === "negotiate"
    ? `${base}. 마감까지 ${remain}시간 남았습니다. 조율안을 찾습니다.`
    : `${base}. 마감까지 ${remain}시간 남아 추가 화물이 합류할 수 있습니다.`;
}

/** 편성이 확정된 뒤(조율 수락 포함) 편익·비용·보조금을 계산합니다. */
export function buildCalc(
  members: Shipment[],
  wagon: EmptyWagon,
  lane: Lane | null,
  seed?: SeedData,
): CalcResult {
  const totalTon = members.reduce((a, m) => a + m.cargo.weightTon, 0);
  const weighted = (pick: (s: Shipment) => number) =>
    members.reduce((a, m) => a + pick(m) * m.cargo.weightTon, 0) / totalTon;

  const input: CalcInput = {
    totalTon,
    railDistanceKm: lane?.railDistanceKm ?? 0,
    roadDirectDistanceKm: weighted((s) => s.roadDirectDistanceKm),
    shuttleDistanceKm: weighted((s) => s.origin.shuttleKm + s.destination.shuttleKm),
    wagonCapacityTon: wagon.capacityTon,
    memberCount: members.length,
    // 편성 내 최대 물량 품목의 최저톤수율을 대표값으로 씁니다.
    itemCategory: [...members]
      .sort((a, b) => b.cargo.weightTon - a.cargo.weightTon)[0]?.cargo.category,
    actualRoadFareKrw:
      members.reduce((a, m) => a + m.currentRoadFareKrw, 0) || undefined,
    members: members.map((m) => ({
      shipmentId: m.id,
      shipperName:
        seed?.shippers.find((sp) => sp.id === m.shipperId)?.name ??
        m.shipperName ??
        m.shipperId,
      weightTon: m.cargo.weightTon,
      shuttleKm: m.origin.shuttleKm + m.destination.shuttleKm,
      currentRoadFareKrw: m.currentRoadFareKrw,
    })),
  };
  return calculate(input);
}

/**
 * 조율안 수락은 `negotiate.ts` 의 `accept()` 를 쓰십시오.
 * 여기 있던 `applyNegotiation` 은 같은 구현이 두 벌 남아 드리프트를 만들어 삭제했습니다.
 */
