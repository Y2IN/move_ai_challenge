/**
 * 매칭 유니버스 로더 — 역·노선·화주·공차·시드화물을 **DB 에서** 읽는다.
 *
 * ## 왜 만들었나
 *
 * 지금까지 매칭·공차·검증은 번들된 seed.json 만 봤다. Supabase 에 같은 데이터를
 * 밀어 넣어도(`npm run db:push`) 아무 코드도 읽지 않아서, 대시보드에서 화차를
 * 한 량 추가해도 화면은 꿈쩍하지 않았다. "DB 위에서 돕니다" 가 사실이 아니었다.
 *
 * ## 계약
 *
 *   1. **전부 아니면 전무.** 다섯 테이블 중 하나라도 비었거나 실패하면 통째로
 *      번들 seed 로 떨어진다. DB 의 화차 + 번들의 화물처럼 섞으면 참조 무결성이
 *      깨진 유니버스가 만들어진다 (없는 노선을 가리키는 화차 등).
 *   2. **날짜는 로드 직후 롤링한다** (roll.ts). DB 경로든 폴백이든 같은 함수를
 *      거치므로 어느 쪽으로 읽어도 시나리오 날짜가 같다.
 *   3. **캐시 60초.** 매 요청마다 다섯 번 왕복하면 화면이 느려진다. store.ts 의
 *      globalThis 패턴을 그대로 쓴다 (Next 캐시 API 는 BE 가 tsx 테스트에서도
 *      돌기 때문에 못 쓴다 — next/cache import 가 그 실행을 깨뜨린다).
 *
 * dashboard·accounts·contracts·settlementDocuments 는 화면 카피·약정에 가까워
 * 번들 seed 에서 그대로 가져온다 (DB 미러 대상이 아니다).
 */

import { tryDb, unwrap } from "./client";
import { rollDemoDates } from "../roll";
import { rawSeed, seed as bundledSeed } from "../seed";
import type { EmptyWagon, Lane, SeedData, Shipment, Shipper, Station } from "../types";

interface StationRow {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  handling: string[];
}

interface LaneRow {
  id: string;
  origin_station_id: string;
  dest_station_id: string;
  rail_distance_km: number;
  road_distance_km: number;
  transit_hours: number;
}

interface ShipperRow {
  id: string;
  name: string;
  industry: string;
  company_grade: Shipper["companyGrade"];
  esg_disclosure_required: boolean;
  contact: Shipper["contact"];
  /** schema.sql 재적용 전 프로젝트에는 컬럼 자체가 없다 */
  contract?: Shipper["contract"] | null;
}

/** 화차·화물은 요일·시각·제약까지 들고 있어 payload(jsonb)에 통째로 보관돼 있다. */
interface PayloadRow<T> {
  id: string;
  payload: T;
}

const TTL_MS = 60_000;

interface UniverseCache {
  data: SeedData;
  source: "db" | "bundle";
  fetchedAt: number;
}

const globalCache = globalThis as unknown as {
  __railhubUniverseCache?: UniverseCache;
};

/** 시연 중 데이터를 바꿔 넣었을 때 즉시 반영하려면 이걸 부른다 (db:push 후 등). */
export function invalidateUniverse(): void {
  globalCache.__railhubUniverseCache = undefined;
}

async function fetchFromDb(): Promise<SeedData | null> {
  return tryDb("loadUniverse", async (db) => {
    /**
     * `contract` 는 나중에 추가된 컬럼이다. schema.sql 을 아직 다시 적용하지 않은
     * 프로젝트에서도 DB 를 쓸 수 있도록, 없으면 컬럼을 빼고 한 번 더 시도한다
     * (전체를 번들로 되돌리면 "DB 를 붙였는데 안 읽는" 상태가 그대로 남는다).
     */
    const loadShippers = async () => {
      const withContract = await db
        .from("shippers")
        .select("id, name, industry, company_grade, esg_disclosure_required, contact, contract")
        .order("id");
      if (!withContract.error) return unwrap(withContract) as ShipperRow[];
      if (!/contract/i.test(withContract.error.message)) throw new Error(withContract.error.message);
      return unwrap(
        await db
          .from("shippers")
          .select("id, name, industry, company_grade, esg_disclosure_required, contact")
          .order("id"),
      ) as ShipperRow[];
    };

    const [stations, lanes, shipperRows, wagons, shipments] = await Promise.all([
      db.from("stations").select("id, name, region, lat, lng, handling").order("id"),
      db
        .from("lanes")
        .select("id, origin_station_id, dest_station_id, rail_distance_km, road_distance_km, transit_hours")
        .order("id"),
      loadShippers(),
      db.from("empty_wagons").select("id, payload").order("id"),
      db.from("seed_shipments").select("id, payload").order("id"),
    ]);

    const stationRows = unwrap(stations) as StationRow[];
    const laneRows = unwrap(lanes) as LaneRow[];
    const wagonRows = unwrap(wagons) as PayloadRow<EmptyWagon>[];
    const shipmentRows = unwrap(shipments) as PayloadRow<Shipment>[];

    // 하나라도 비면 "DB 는 살아 있는데 시드가 안 들어간 상태" 다. 섞지 않고 폴백한다.
    if (
      !stationRows.length ||
      !laneRows.length ||
      !shipperRows.length ||
      !wagonRows.length ||
      !shipmentRows.length
    ) {
      return null;
    }

    const stationList: Station[] = stationRows.map((r) => ({
      id: r.id,
      name: r.name,
      region: r.region,
      lat: r.lat,
      lng: r.lng,
      handling: r.handling,
    }));

    const laneList: Lane[] = laneRows.map((r) => ({
      id: r.id,
      originStationId: r.origin_station_id,
      destStationId: r.dest_station_id,
      railDistanceKm: r.rail_distance_km,
      roadDistanceKm: r.road_distance_km,
      transitHours: r.transit_hours,
    }));

    const shipperList: Shipper[] = shipperRows.map((r) => {
      // contract 컬럼이 아직 없거나 비어 있으면 번들 값으로 메운다 —
      // 화주영업 화면(clients.ts)이 계약 물량을 분모로 쓰기 때문에 비면 0 나눗셈이 된다.
      const fallback = rawSeed.shippers.find((s) => s.id === r.id);
      const contract =
        r.contract && Object.keys(r.contract).length > 0 ? r.contract : fallback?.contract;
      return {
        id: r.id,
        name: r.name,
        industry: r.industry,
        companyGrade: r.company_grade,
        esgDisclosureRequired: r.esg_disclosure_required,
        contact: r.contact,
        contract: contract as Shipper["contract"],
      };
    });

    return {
      // ⚠️ rawSeed (롤링 전) 를 펼친다. bundledSeed 는 anchor 가 이미 "오늘"이라
      //    이걸 펼치면 아래 rollDemoDates 의 delta 가 0 이 되어 DB 날짜가 안 밀린다.
      ...rawSeed,
      stations: stationList,
      lanes: laneList,
      shippers: shipperList,
      emptyWagons: wagonRows.map((r) => r.payload),
      shipments: shipmentRows.map((r) => r.payload),
    } satisfies SeedData;
  });
}

/**
 * 매칭 유니버스. DB 우선, 실패하면 번들 seed. 날짜는 항상 오늘 기준으로 롤링된다.
 *
 * `bundledSeed` 는 이미 seed.ts 에서 롤링된 값이지만 여기서 다시 부른다 —
 * 프로세스가 며칠 살아 있어도(서버리스 warm 인스턴스) 날짜가 따라오게 하려면
 * 모듈 로드 시점이 아니라 **요청 시점**에 밀어야 한다. 롤링은 멱등이다.
 */
export async function loadUniverse(): Promise<SeedData> {
  const cached = globalCache.__railhubUniverseCache;
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.data;

  // 폴백도 rawSeed 를 쓴다 — bundledSeed 는 모듈 로드 시점에 한 번 롤링된 값이라,
  // 인스턴스가 며칠 살아 있으면 그 날짜에 얼어붙는다.
  const fromDb = await fetchFromDb();
  const data = rollDemoDates(fromDb ?? rawSeed);

  globalCache.__railhubUniverseCache = {
    data,
    source: fromDb ? "db" : "bundle",
    fetchedAt: Date.now(),
  };
  return data;
}

/** 지금 유니버스를 어디서 읽고 있는지 — /api/health 표시용. */
export function universeSource(): "db" | "bundle" | "unknown" {
  return globalCache.__railhubUniverseCache?.source ?? "unknown";
}
