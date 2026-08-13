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
  /** 사용자가 방금 등록한 화물이면 true */
  isUserInput: boolean;
  /** 조율(양보)이 있어야 실을 수 있는 화물이면 그 이유 */
  requiresNegotiation: string | null;
}

export interface MatchResult {
  status: "matched" | "shortfall" | "noWagon";
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

/** 사용자 입력을 Shipment 형태로 정규화. 빠진 값은 시드 기준으로 추정합니다. */
export function normalizeInput(input: ShipmentInput, seed: SeedData): Shipment {
  const lane = findLane(seed, input.originStationId, input.destStationId);
  const shuttleIn = input.originShuttleKm ?? 10;
  const shuttleOut = input.destShuttleKm ?? 25;
  const roadKm = lane?.roadDistanceKm ?? 380;

  return {
    id: "SHM-USER-001",
    shipperId: "SHP-USER",
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
    transportArrangement: input.transportArrangement,
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
    isUserInput,
    requiresNegotiation: null,
  };
}

/** 화차가 화물의 물리 요건을 만족하는지 */
function wagonViolation(wagon: EmptyWagon, shipments: Shipment[]): string | null {
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
function scheduleFits(s: Shipment, wagon: EmptyWagon): boolean {
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
export function match(seed: SeedData, input: ShipmentInput | null): MatchResult {
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

    const seat = (s: Shipment) => {
      if (load + s.cargo.weightTon > wagon.capacityTon) return;
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

  // 정원 미달이면 여기서 멈추고 조율 에이전트로 넘깁니다 (계산은 아직 안 함).
  if (shortfallTon > 0) {
    return {
      status: "shortfall",
      wagon,
      lane,
      members: memberCandidates,
      totalTon,
      capacityTon: wagon.capacityTon,
      loadFactor: totalTon / wagon.capacityTon,
      shortfallTon,
      negotiationCandidates,
      calc: null,
      message: `동일 노선 ${members.length}건 감지. 합계 ${totalTon}톤 / 정원 ${wagon.capacityTon}톤 — ${shortfallTon}톤 부족으로 편성이 성립하지 않습니다.`,
    };
  }

  return {
    status: "matched",
    wagon,
    lane,
    members: memberCandidates,
    totalTon,
    capacityTon: wagon.capacityTon,
    loadFactor: totalTon / wagon.capacityTon,
    shortfallTon: 0,
    negotiationCandidates,
    calc: buildCalc(members, wagon, lane),
    message: `동일 노선 ${members.length}건 · ${wagon.label} 배정 완료 · 적재율 ${Math.round((totalTon / wagon.capacityTon) * 100)}%`,
  };
}

/** 편성이 확정된 뒤(조율 수락 포함) 편익·비용·보조금을 계산합니다. */
export function buildCalc(
  members: Shipment[],
  wagon: EmptyWagon,
  lane: Lane | null,
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
    actualRoadFareKrw:
      members.reduce((a, m) => a + m.currentRoadFareKrw, 0) || undefined,
  };
  return calculate(input);
}

/** 조율안 수락 — 예정 물량을 편성에 끌어와 다시 계산합니다. */
export function applyNegotiation(
  seed: SeedData,
  input: ShipmentInput | null,
  acceptedShipmentIds: string[],
): MatchResult {
  const patched: SeedData = {
    ...seed,
    shipments: seed.shipments.map((s) =>
      acceptedShipmentIds.includes(s.id) ? { ...s, status: "requested" as const } : s,
    ),
  };
  return match(patched, input);
}