/**
 * 수송 실적 원장 로더 — trips + trip_members 를 **DB 에서** 읽는다.
 *
 * 랜딩·정산·ESG 리포트·추이·화주영업이 전부 이 원장을 집계한다. 지금까지는
 * 번들 ledger.json 만 봤고, Supabase 의 trips(1,297) · trip_members(4,431) 는
 * 아무도 읽지 않는 미러였다.
 *
 * ## 캐시 설계
 *
 * 집계 자체는 인프로세스 계산이라 수 ms 다 — 병목은 왕복이다. 그래서 원장
 * **원본을 인스턴스당 한 번** 가져와 globalThis 에 5분간 들고, 그 위에서
 * 기존 동기 `aggregate()` 를 그대로 돌린다. 집계 결과도 (from,to,shipperId)
 * 키로 메모해 같은 화면을 다시 열 때 재계산을 건너뛴다.
 *
 * Next 의 unstable_cache 를 쓰지 않는 이유: BE 는 Next 밖에서도 돈다
 * (`npm -w BE run test:esg` 가 tsx 로 aggregate 를 직접 부르고,
 * scripts/gen-ledger.ts 도 같은 모듈을 쓴다). next/cache 를 import 하면
 * 그 실행 경로가 통째로 깨진다.
 */

import { tryDb, unwrap } from "./client";
import bundledLedgerRaw from "../esg/ledger.json";
import type { EsgAggregate } from "../esg/types";
import type { LedgerData, LedgerMember, LedgerTrip } from "../esg/types";

export const bundledLedger = bundledLedgerRaw as unknown as LedgerData;

interface TripRow {
  id: string;
  trip_date: string;
  lane_id: string;
  origin_station_id: string;
  dest_station_id: string;
  wagon_id: string;
  wagon_type: LedgerTrip["wagonType"];
  wagon_capacity_ton: number;
}

interface MemberRow {
  lot_id: string;
  trip_id: string;
  shipper_id: string;
  shipper_name: string;
  category: LedgerMember["category"];
  weight_ton: number;
  shuttle_km: number;
  road_direct_distance_km: number;
  current_road_fare_krw: number;
}

/** PostgREST 는 한 번에 1,000행까지 준다. 원장은 그보다 크므로 나눠 받는다. */
const PAGE = 1_000;
const TTL_MS = 5 * 60_000;

interface LedgerCache {
  data: LedgerData;
  source: "db" | "bundle";
  fetchedAt: number;
  agg: Map<string, EsgAggregate>;
}

const globalCache = globalThis as unknown as { __railhubLedgerCache?: LedgerCache };

export function invalidateLedger(): void {
  globalCache.__railhubLedgerCache = undefined;
}

async function fetchFromDb(): Promise<LedgerData | null> {
  return tryDb("loadLedger", async (db) => {
    const trips: TripRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = unwrap(
        await db
          .from("trips")
          .select("id, trip_date, lane_id, origin_station_id, dest_station_id, wagon_id, wagon_type, wagon_capacity_ton")
          .order("id")
          .range(from, from + PAGE - 1),
      ) as TripRow[];
      trips.push(...page);
      if (page.length < PAGE) break;
    }
    if (!trips.length) return null;

    const members: MemberRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = unwrap(
        await db
          .from("trip_members")
          .select("lot_id, trip_id, shipper_id, shipper_name, category, weight_ton, shuttle_km, road_direct_distance_km, current_road_fare_krw")
          .order("lot_id")
          .range(from, from + PAGE - 1),
      ) as MemberRow[];
      members.push(...page);
      if (page.length < PAGE) break;
    }
    if (!members.length) return null;

    const byTrip = new Map<string, LedgerMember[]>();
    for (const m of members) {
      const list = byTrip.get(m.trip_id) ?? [];
      list.push({
        lotId: m.lot_id,
        shipperId: m.shipper_id,
        shipperName: m.shipper_name,
        category: m.category,
        weightTon: m.weight_ton,
        shuttleKm: m.shuttle_km,
        roadDirectDistanceKm: m.road_direct_distance_km,
        currentRoadFareKrw: m.current_road_fare_krw,
      });
      byTrip.set(m.trip_id, list);
    }

    const assembled: LedgerTrip[] = trips
      .map((t) => ({
        id: t.id,
        date: t.trip_date,
        laneId: t.lane_id,
        originStationId: t.origin_station_id,
        destStationId: t.dest_station_id,
        wagonId: t.wagon_id,
        wagonType: t.wagon_type,
        wagonCapacityTon: t.wagon_capacity_ton,
        members: byTrip.get(t.id) ?? [],
      }))
      // 로트가 없는 편성은 집계에 기여하지 않는다 (members 투입 실패 흔적일 수 있다)
      .filter((t) => t.members.length > 0)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    if (!assembled.length) return null;

    return {
      meta: { ...bundledLedger.meta, notes: [...bundledLedger.meta.notes, "이 원장은 Supabase trips/trip_members 에서 읽었습니다."] },
      trips: assembled,
    } satisfies LedgerData;
  });
}

/** 원장 원본. DB 우선, 실패하거나 비어 있으면 번들 ledger.json. */
export async function loadLedger(): Promise<LedgerData> {
  const cached = globalCache.__railhubLedgerCache;
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.data;

  const fromDb = await fetchFromDb();
  const data = fromDb ?? bundledLedger;
  globalCache.__railhubLedgerCache = {
    data,
    source: fromDb ? "db" : "bundle",
    fetchedAt: Date.now(),
    agg: new Map(),
  };
  return data;
}

/** 집계 결과 메모 — 같은 (기간, 화주) 조합을 다시 계산하지 않는다. */
export function memoAggregate(key: string, compute: () => EsgAggregate): EsgAggregate {
  const cache = globalCache.__railhubLedgerCache;
  if (!cache) return compute();
  const hit = cache.agg.get(key);
  if (hit) return hit;
  const value = compute();
  cache.agg.set(key, value);
  return value;
}

export function ledgerSource(): "db" | "bundle" | "unknown" {
  return globalCache.__railhubLedgerCache?.source ?? "unknown";
}
