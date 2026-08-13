import { match, wagonPhase } from "@railhub/be/matching";
import { quote } from "@railhub/be/quote";
import { seed } from "@railhub/be/seed";
import type { MemberInput } from "@railhub/be/calc";
import type { ShipmentInput } from "@railhub/be/types";

/**
 * api_list #18 — 코레일 공차 현황 (04b 모집 현황 화면).
 *
 * 화주가 등록 시점에 알아야 하는 건 "지금 확정하면 얼마"와 "다 차면 얼마",
 * 그리고 **최악이어도 얼마를 넘지 않는지**다. 셋을 함께 준다.
 *
 * 상한은 화주가 지금 내고 있는 도로 운임이다. 그래서 언제 등록하든 손해가 없고,
 * 많이 모일수록 자기가 싸지므로 다른 화주를 데려올 유인이 생긴다.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { shipment?: ShipmentInput; now?: string }
    | null;

  const now = body?.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return Response.json({ error: "now 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const current = match(seed, body?.shipment ?? null, now);
  const shipment = body?.shipment;

  const vacancies = seed.emptyWagons.map((wagon) => {
    const lane = seed.lanes.find((l) => l.id === wagon.laneId);
    const phase = wagonPhase(wagon, current.totalTon, now);
    const base = {
      railDistanceKm: lane?.railDistanceKm ?? 0,
      roadDirectDistanceKm: lane?.roadDistanceKm ?? 0,
      shuttleDistanceKm: 0,
      wagonCapacityTon: wagon.capacityTon,
    };

    // 이 화차에 이미 잡혀 있는 화주들
    const others: MemberInput[] = current.members
      .filter((m) => !m.isUserInput)
      .map((m) => {
        const s = seed.shipments.find((x) => x.id === m.shipmentId);
        return {
          shipmentId: m.shipmentId,
          shipperName: m.shipperName,
          weightTon: m.weightTon,
          shuttleKm: s ? s.origin.shuttleKm + s.destination.shuttleKm : 0,
          currentRoadFareKrw: s?.currentRoadFareKrw ?? 0,
        };
      });

    const target: MemberInput | null = shipment
      ? {
          shipmentId: "SHM-USER-001",
          shipperName: shipment.shipperName ?? "내 화물",
          weightTon: shipment.weightTon,
          shuttleKm: (shipment.originShuttleKm ?? 10) + (shipment.destShuttleKm ?? 25),
          currentRoadFareKrw: shipment.currentRoadFareKrw ?? 0,
        }
      : null;

    return {
      wagon: {
        id: wagon.id,
        label: wagon.label,
        wagonType: wagon.wagonType,
        capacityTon: wagon.capacityTon,
        // 이미 확보된 물량. 코레일 화면이 "얼마나 비었는지"를 그리는 값이다.
        reservedTon: wagon.reservedTon,
        departure: wagon.departure,
        arrival: wagon.arrival,
        cutoffAt: wagon.cutoffAt,
        minLoadRate: wagon.minLoadRate,
        // 왜 비어 있는지 — 공차 관리 화면에서 담당자가 가장 먼저 보는 맥락이다.
        emptyReason: wagon.emptyReason,
      },
      route: lane
        ? `${seed.stations.find((s) => s.id === lane.originStationId)?.name} → ${seed.stations.find((s) => s.id === lane.destStationId)?.name}`
        : null,
      ...phase,
      // 견적은 대상 화물이 있을 때만 의미가 있다
      quote: target ? quote(target, others, wagon, base, now) : null,
    };
  });

  return Response.json({ vacancies });
}
