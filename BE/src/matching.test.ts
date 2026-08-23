/**
 * 매칭 코어 회귀 테스트 — `npx tsx src/matching.test.ts`
 *
 * 시나리오 3중 잠금이 다시 생기는 걸 막는다:
 *   1) 날짜 부패 — 롤링 후 cutoff 는 항상 미래·조율 윈도우(48h) 안
 *   2) 그리디 비단조 — 중량을 올렸는데 총 적재량이 줄어드는 구간
 *   3) 노선 검증 구멍 — 역방향 입력이 전 화차를 통과하고 철도거리 0 으로 계산
 */

import raw from "./seed.json";
import { match, NEGOTIATION_WINDOW_HOURS, scheduleFits, seatOnWagon, shipmentOnLane } from "./matching";
import { accept } from "./negotiate";
import { rollDemoDates, todayYmd } from "./roll";
import type { SeedData, Shipment, ShipmentInput } from "./types";

let pass = 0;
let fail = 0;

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`✅ ${name}${detail ? `  → ${detail}` : ""}`);
  } else {
    fail++;
    console.error(`❌ ${name}${detail ? `  → ${detail}` : ""}`);
  }
}

// 테스트 기준 시각 — 롤링 목적지(오늘) 오전 10시로 고정
const NOW = new Date(`${todayYmd()}T10:00:00+09:00`);
const seed = rollDemoDates(raw as unknown as SeedData, NOW);

const input = (over: Partial<ShipmentInput> = {}): ShipmentInput => ({
  originStationId: "ULS-FRT",
  destStationId: "OBONG",
  category: "기타",
  weightTon: 4,
  desiredDepartureDate: seed.emptyWagons[0].departure.date,
  companyGrade: "sme",
  transportArrangement: "consignment",
  ...over,
});

// ── 1. 날짜 롤링 ───────────────────────────────────────────────

{
  const a17 = seed.emptyWagons.find((w) => w.id === "WGN-A17")!;
  const hours = (new Date(a17.cutoffAt).getTime() - NOW.getTime()) / 3_600_000;
  ok("롤링 후 A17 마감이 미래다", hours > 0, `${hours.toFixed(1)}h`);
  ok("A17 마감이 조율 윈도우(48h) 안이다", hours <= NEGOTIATION_WINDOW_HOURS, `${hours.toFixed(1)}h`);
  ok(
    "롤링은 멱등이다 (두 번 적용해도 동일)",
    JSON.stringify(rollDemoDates(seed, NOW)) === JSON.stringify(seed),
  );
  const sundays = seed.emptyWagons.filter(
    (w) => new Date(`${w.departure.date}T00:00:00Z`).getUTCDay() === 0,
  );
  ok("일요일에 출발하는 화차가 없다", sundays.length === 0, sundays.map((w) => w.id).join(","));
}

// ── 2. 시드 단독 — 조율 데모 시나리오 보존 ─────────────────────

{
  const r = match(seed, null, NOW);
  ok("시드 단독은 정원 미달(shortfall)", r.status === "shortfall", `${r.status}`);
  ok("시드 단독 phase 는 negotiate", r.phase === "negotiate", r.phase);
  ok("시드 단독 적재는 14/18t", r.totalTon === 14 && r.capacityTon === 18, `${r.totalTon}/${r.capacityTon}`);
  ok("조율 후보에 SHM-C-002 가 있다", r.negotiationCandidates.some((c) => c.shipmentId === "SHM-C-002"));

  const pulled = accept(seed, null, ["SHM-C-002"], NOW);
  ok("C-002 당기면 100% 성립", pulled.result.status === "matched" && pulled.result.loadFactor === 1, `${(pulled.result.loadFactor * 100).toFixed(0)}%`);
}

// ── 3. 사용자 입력 매칭 ────────────────────────────────────────

{
  const r4 = match(seed, input({ weightTon: 4 }), NOW);
  ok("4t 입력 → 즉시 만재 확정", r4.status === "matched" && r4.loadFactor === 1, `${r4.status} ${(r4.loadFactor * 100).toFixed(0)}%`);

  // 그리디 회귀 — 전수탐색 결과가 그리디(무거운 것부터)보다 항상 크거나 같아야 한다.
  // 예전 그리디는 10t 입력에서 10+6=16t 에 멈췄다 (최적은 10+5+3=18t 만재).
  const greedyLoad = (w: number): number => {
    const user = w;
    const others = [6, 5, 3]; // A-001, B-001, C-001 (무거운 순)
    let load = user > 18 ? 0 : user;
    if (load === 0) return 0;
    for (const t of others) if (load + t <= 18) load += t;
    return load;
  };
  let allAtLeastGreedy = true;
  const loads: number[] = [];
  for (let w = 1; w <= 15; w++) {
    const r = match(seed, input({ weightTon: w }), NOW);
    loads.push(r.totalTon);
    if (r.wagon?.id === "WGN-A17" && r.totalTon + 1e-9 < greedyLoad(w)) allAtLeastGreedy = false;
  }
  ok("전수탐색 ≥ 그리디 (1~15t 스윕)", allAtLeastGreedy, loads.join(","));

  const r10 = match(seed, input({ weightTon: 10 }), NOW);
  ok("10t 입력 → 만재 조합(10+5+3=18t) 발견", r10.totalTon === 18 && r10.loadFactor === 1, `${r10.totalTon}t (그리디는 16t 에 멈췄다)`);
}

// ── 4. 노선 검증 ───────────────────────────────────────────────

{
  const rev = match(seed, input({ originStationId: "OBONG", destStationId: "ULS-FRT" }), NOW);
  ok("역방향 입력은 noWagon", rev.status === "noWagon", rev.status);
  ok("역방향 메시지에 개설 노선 안내", rev.message.includes("노선"), rev.message);
}

// ── 5. 유연폭 ──────────────────────────────────────────────────

{
  const a17dep = seed.emptyWagons.find((w) => w.id === "WGN-A17")!.departure.date;
  const dayBefore = new Date(`${a17dep}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);
  const want = dayBefore.toISOString().slice(0, 10);

  const flex0 = match(seed, input({ desiredDepartureDate: want, departureFlexDays: 0 }), NOW);
  const flex2 = match(seed, input({ desiredDepartureDate: want, departureFlexDays: 2 }), NOW);
  ok("이틀 어긋난 날짜 + 유연폭 0 → 미탑승", flex0.status === "noWagon", flex0.status);
  ok("이틀 어긋난 날짜 + 유연폭 2 → 탑승", flex2.status !== "noWagon", flex2.status);

  const def = match(seed, input({ desiredDepartureDate: want }), NOW);
  ok("유연폭 기본값은 ±2 (미지정도 탑승)", def.status !== "noWagon", def.status);
}

// ── 6. 하이브리드 매칭 — 등록 화물은 채우되 시나리오 화차는 지킨다 ──

{
  const dep = seed.emptyWagons.find((w) => w.id === "WGN-B04")!.departure.date;
  /** 저장소에서 온 것처럼 표시한 등록 화물 */
  const registryShipment = (id: string, ton: number): Shipment => ({
    ...seed.shipments.find((s) => s.id === "SHM-C-001")!,
    id,
    shipperId: "SHP-USER",
    shipperName: "등록 화주",
    fromRegistry: true,
    cargo: {
      ...seed.shipments.find((s) => s.id === "SHM-C-001")!.cargo,
      weightTon: ton,
      requiresCover: false,
    },
    schedule: { requestedDepartureDate: dep, requiredArrivalBy: "" },
    fallbackHints: {
      departureFlexDays: 2,
      hardArrivalBy: null,
      mustBeCovered: false,
      noWeekendDispatch: false,
      requiresForklift: false,
    },
  });

  const hybrid: SeedData = {
    ...seed,
    shipments: [...seed.shipments, registryShipment("SHM-USER-901", 12)],
  };

  const a17 = seed.emptyWagons.find((w) => w.id === "WGN-A17")!;
  const b04 = seed.emptyWagons.find((w) => w.id === "WGN-B04")!;
  const onLane = (s: Shipment) => shipmentOnLane(s, seed.lanes[0]);

  const seatedA17 = seatOnWagon(
    a17,
    hybrid.shipments.filter((s) => s.status === "requested" && onLane(s) && scheduleFits(s, a17)),
    null,
  );
  ok("시나리오 화차는 등록 화물을 안 태운다 (14t 유지)", seatedA17.totalTon === 14, `${seatedA17.totalTon}t`);

  const seatedB04 = seatOnWagon(
    b04,
    hybrid.shipments.filter((s) => s.status === "requested" && onLane(s) && scheduleFits(s, b04)),
    null,
  );
  ok(
    "일반 화차는 등록 화물로 채워진다",
    seatedB04.members.some((m) => m.id === "SHM-USER-901"),
    `${seatedB04.totalTon}t · ${seatedB04.members.map((m) => m.id).join(",")}`,
  );

  // 역방향 등록 화물이 남의 편성에 올라타면 안 된다
  const reverse: Shipment = {
    ...registryShipment("SHM-USER-902", 10),
    origin: { ...seed.shipments[0].origin, stationId: "OBONG" },
    destination: { ...seed.shipments[0].destination, stationId: "ULS-FRT" },
  };
  ok("역방향 등록 화물은 노선 필터에 걸린다", !shipmentOnLane(reverse, seed.lanes[0]));

  // 적재율로 화차를 고른다 (톤수로 고르면 헐거운 큰 화차가 이긴다)
  const picked = match(hybrid, null, NOW);
  ok(
    "적재율이 높은 화차를 고른다 (시나리오 유지)",
    picked.wagon?.id === "WGN-A17",
    `${picked.wagon?.id} ${picked.totalTon}/${picked.capacityTon}t`,
  );
}

// ── 7. seatOnWagon 물리 요건 ───────────────────────────────────

{
  const b04 = seed.emptyWagons.find((w) => w.id === "WGN-B04")!;
  const eligible = seed.shipments.filter((s) => s.status === "requested" && scheduleFits(s, b04));
  const seated = seatOnWagon(b04, eligible, null);
  const coverViolators = seated.members.filter((m) => m.cargo.requiresCover);
  ok("무개화차(B04)에 유개 필요 화물이 안 탄다", coverViolators.length === 0, seated.members.map((m) => m.id).join(",") || "빈 편성");
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail > 0) process.exit(1);
