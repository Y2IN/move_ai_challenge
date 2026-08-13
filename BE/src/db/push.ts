/**
 * seed.json + ledger.json 을 Supabase 에 밀어넣는다.
 *
 *   npm run db:push
 *
 * **몇 번을 다시 돌려도 안전하다** (전부 upsert). 데이터를 고칠 땐 JSON 만 수정하고
 * 이 스크립트를 다시 돌리면 된다 — 대시보드에서 손으로 칠 일은 없다.
 *
 * ⚠️ 앱 런타임과 달리 이 스크립트는 **환경변수가 없으면 그냥 죽는다.** 폴백이 없다.
 *    "조용히 아무것도 안 하고 성공했다고 말하는" 게 제일 나쁜 결과이기 때문이다.
 *
 * 실행 전에 schema.sql 을 먼저 적용해야 한다 (Supabase → SQL Editor 에 붙여넣고 Run).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ledgerRaw from "../esg/ledger.json";
import { seed } from "../seed";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

// ── 환경변수 ───────────────────────────────────────────────────

/**
 * `.env.local` 을 직접 읽는다.
 *
 * Next 는 자기가 뜰 때 FE/.env.local 을 읽지만, 이 스크립트는 Next 밖에서 도는
 * 단독 프로세스라 아무도 안 읽어 준다. 같은 파일을 보게 해서 키를 두 군데
 * 관리하지 않도록 한다.
 */
function loadEnvFile(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // 없으면 조용히 넘어간다 — 셸 환경변수로 줄 수도 있다
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue; // 이미 셸에 있으면 그쪽이 우선
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(resolve(repoRoot, "FE/.env.local"));
loadEnvFile(resolve(repoRoot, ".env.local"));

const url = (process.env.SUPABASE_URL ?? "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (!url || !key) {
  console.error(
    [
      "",
      "✖ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.",
      "",
      "  FE/.env.local 에 아래 두 줄을 넣으세요 (Supabase → Project Settings → API):",
      "",
      "    SUPABASE_URL=https://<project-ref>.supabase.co",
      "    SUPABASE_SERVICE_ROLE_KEY=<service_role secret>",
      "",
      "  ⚠️ service_role 키는 RLS 를 우회합니다. NEXT_PUBLIC_ 접두어를 붙이지 마세요.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const db: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── 원장 타입 (ledger.json) ────────────────────────────────────

interface TripMember {
  lotId: string;
  shipperId: string;
  shipperName: string;
  category: string;
  weightTon: number;
  shuttleKm: number;
  roadDirectDistanceKm: number;
  currentRoadFareKrw: number;
}

interface Trip {
  id: string;
  date: string;
  laneId: string;
  originStationId: string;
  destStationId: string;
  wagonId: string;
  wagonType: string;
  wagonCapacityTon: number;
  members: TripMember[];
}

const ledger = ledgerRaw as unknown as { trips: Trip[] };

// ── 유틸 ───────────────────────────────────────────────────────

/** upsert 한 벌. 실패하면 즉시 죽는다 (부분 투입 상태로 성공을 보고하지 않기 위해). */
async function push(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  if (!rows.length) {
    console.log(`  · ${table.padEnd(22)} 0건 (건너뜀)`);
    return;
  }
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`\n✖ ${table} 투입 실패: ${error.message}`);
    if (/does not exist|schema cache/i.test(error.message)) {
      console.error("  → schema.sql 을 아직 적용하지 않은 것 같습니다.");
      console.error("     Supabase 대시보드 → SQL Editor 에 BE/src/db/schema.sql 을 붙여넣고 Run 하세요.\n");
    }
    process.exit(1);
  }
  console.log(`  ✓ ${table.padEnd(22)} ${rows.length}건`);
}

// ── 투입 ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n▶ Supabase 로 시드 투입 — ${url}\n`);

  console.log("기준 데이터 (seed.json)");

  // 외래키 순서: stations → lanes → empty_wagons
  await push(
    "stations",
    seed.stations.map((s) => ({
      id: s.id,
      name: s.name,
      region: s.region,
      lat: s.lat,
      lng: s.lng,
      handling: s.handling,
    })),
    "id",
  );

  await push(
    "lanes",
    seed.lanes.map((l) => ({
      id: l.id,
      origin_station_id: l.originStationId,
      dest_station_id: l.destStationId,
      rail_distance_km: l.railDistanceKm,
      road_distance_km: l.roadDistanceKm,
      transit_hours: l.transitHours,
    })),
    "id",
  );

  await push(
    "shippers",
    seed.shippers.map((s) => ({
      id: s.id,
      name: s.name,
      industry: s.industry,
      company_grade: s.companyGrade,
      esg_disclosure_required: s.esgDisclosureRequired,
      contact: s.contact,
    })),
    "id",
  );

  await push(
    "empty_wagons",
    seed.emptyWagons.map((w) => ({
      id: w.id,
      label: w.label,
      wagon_type: w.wagonType,
      capacity_ton: w.capacityTon,
      capacity_cbm: w.capacityCbm,
      capacity_basis: w.capacityBasis,
      cutoff_at: w.cutoffAt,
      min_load_rate: w.minLoadRate,
      reserved_ton: w.reservedTon,
      lane_id: w.laneId,
      departure_date: w.departure.date,
      arrival_date: w.arrival.date,
      empty_reason: w.emptyReason,
      handling: w.handling,
      payload: w,
    })),
    "id",
  );

  await push(
    "seed_shipments",
    seed.shipments.map((s) => ({
      id: s.id,
      shipper_id: s.shipperId,
      status: s.status,
      pull_forward_eligible: s.pullForwardEligible ?? false,
      category: s.cargo.category,
      weight_ton: s.cargo.weightTon,
      origin_station_id: s.origin.stationId,
      dest_station_id: s.destination.stationId,
      departure_date: s.schedule.requestedDepartureDate,
      payload: s,
    })),
    "id",
  );

  console.log("\n확정 수송 실적 원장 (ledger.json)");

  await push(
    "trips",
    ledger.trips.map((t) => ({
      id: t.id,
      trip_date: t.date,
      lane_id: t.laneId,
      origin_station_id: t.originStationId,
      dest_station_id: t.destStationId,
      wagon_id: t.wagonId,
      wagon_type: t.wagonType,
      wagon_capacity_ton: t.wagonCapacityTon,
    })),
    "id",
  );

  // trips 가 먼저 들어가야 FK 가 성립한다.
  await push(
    "trip_members",
    ledger.trips.flatMap((t) =>
      t.members.map((m) => ({
        lot_id: m.lotId,
        trip_id: t.id,
        shipper_id: m.shipperId,
        shipper_name: m.shipperName,
        category: m.category,
        weight_ton: m.weightTon,
        shuttle_km: m.shuttleKm,
        road_direct_distance_km: m.roadDirectDistanceKm,
        current_road_fare_krw: m.currentRoadFareKrw,
      })),
    ),
    "lot_id",
  );

  const lotCount = ledger.trips.reduce((n, t) => n + t.members.length, 0);
  console.log(
    [
      "",
      "✔ 완료.",
      `  기준 데이터 — 역 ${seed.stations.length} · 노선 ${seed.lanes.length} · 화주 ${seed.shippers.length} · 공차 ${seed.emptyWagons.length} · 화물 ${seed.shipments.length}`,
      `  실적 원장  — 편성 ${ledger.trips.length} · 로트 ${lotCount}`,
      "",
      "  Supabase 대시보드 → Table Editor 에서 바로 확인할 수 있습니다.",
      "",
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error("\n✖ 예기치 못한 오류:", e);
  process.exit(1);
});