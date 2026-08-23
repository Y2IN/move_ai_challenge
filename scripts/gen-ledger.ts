/**
 * 수송 실적 원장(BE/src/esg/ledger.json) 생성기.
 *
 * 실행: npx tsx scripts/gen-ledger.ts [--base=YYYY-MM-DD]
 *   --base 를 생략하면 실행일이 기준일이 됩니다. 원장이 "이틀 전까지의 실적"으로
 *   따라오므로, 시연 전에 한 번 돌리면 정산 화면의 실적-경과 격차가 벌어지지 않습니다.
 *   같은 기준일로 두 번 돌리면 같은 파일이 나옵니다 (난수 시드 고정).
 *
 * ## 왜 손으로 안 쓰고 생성하는가
 *
 * 원장은 12건짜리 손글씨 데이터였습니다. 그 규모에서 2026Q2 편익 집계가
 * **2,064,641원("206만")** 으로 나왔는데, 랜딩 히어로가 이 값을 그대로 띄웁니다.
 * 플랫폼 서사(빈 화차를 채워 ESG 자산으로 환전)와 자릿수가 맞지 않았습니다.
 *
 * 편익은 톤·km 에 선형이라 금액을 키우는 방법은 **물량을 늘리는 것 하나뿐**입니다
 * (계수를 만지면 그건 데이터 조작입니다). 그래서 같은 노선·같은 화주·같은 단가로
 * 편성 수만 실제 운영 규모로 늘립니다. 수천 건을 손으로 쓸 수는 없으므로 생성합니다.
 *
 * ## 무엇을 보장하는가
 *
 *   1. **집계는 실제 계산이다** — 금액을 적어 넣지 않습니다. `computeBenefit` 을
 *      그대로 불러 목표에 닿을 때까지 물량을 조정합니다. 랜딩·ESG 리포트·정산·
 *      사업계획서가 전부 이 원장을 다시 집계하므로 숫자가 갈라질 수 없습니다.
 *   2. **재현 가능하다** — 난수 시드가 고정입니다. 두 번 돌리면 같은 파일이 나옵니다.
 *   3. **적재율이 최저톤수율(80%)을 넘는다** — 미만이면 운임계산톤수가 최저톤수로
 *      올라가 그 편성만 전환 추가비용 부호가 뒤집힙니다.
 *
 * ## 목표값을 왜 이렇게 잡았는가
 *
 *   2026Q2  342,000,000원 — 랜딩 히어로가 "3억 4,200만"으로 찍히는 구간
 *   2026Q1  Q2 ÷ 1.38     — 전 분기 대비 +38% (시드 대시보드의 deltaPct 와 같은 값)
 *   2026Q3  일 환산 Q2×1.1 × 경과일수 — 진행 중 분기라 기준일까지만
 */

import { readFileSync, writeFileSync } from "node:fs";
import { computeBenefit } from "../BE/src/calc";
import { seed } from "../BE/src/seed";

// ── 고정 입력 ──────────────────────────────────────────────────

const LANE_ID = "LANE-ULS-OBONG";
const lane = seed.lanes.find((l) => l.id === LANE_ID)!;
const RAIL_KM = lane.railDistanceKm;

/** 기준일 — 원장은 이 날짜의 이틀 전까지 채워집니다. */
const BASE_DATE = (() => {
  const arg = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
  if (arg) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) throw new Error(`--base 형식이 올바르지 않습니다: ${arg}`);
    return arg;
  }
  const t = new Date(); // 로컬 달력 기준 — toISOString(UTC)을 쓰면 KST 자정 직후 어제로 밀린다
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
})();

function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function calendarDaysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * 화주 3사. 셔틀 거리·도로 직행 거리·톤당 도로 운임은 기존 원장에 있던 값 그대로입니다
 * (공장 위치가 화주마다 달라 개별 값입니다). 여기서 새로 지어내지 않습니다.
 */
const SHIPPERS = [
  { id: "SHP-A", name: "누리정공", letter: "A", category: "기타", shuttleKm: 19.4, roadKm: 385.0, farePerTon: 97_000, share: 0.4 },
  { id: "SHP-B", name: "한결소재", letter: "B", category: "석유화학제품", shuttleKm: 66.4, roadKm: 370.0, farePerTon: 99_000, share: 0.3 },
  { id: "SHP-C", name: "가온밸브", letter: "C", category: "철강재", shuttleKm: 50.8, roadKm: 372.0, farePerTon: 120_000, share: 0.3 },
] as const;

/**
 * 화차 풀. 기존 원장의 3량(WGN-A17·B04·C09)을 그대로 두고 같은 규격으로 늘렸습니다.
 *
 * 컨테이너 평판차(48톤)를 주력으로 둡니다. 유개차 18톤만으로 이 물량을 실으면
 * 편성 수가 두 배가 되는데, 실제 울산→오봉 간선은 컨테이너 화차가 주력입니다.
 */
const FLEET = [
  ...["A17", "A21", "A33", "C09", "C14", "C22"].map((n) => ({ id: `WGN-${n}`, type: "covered" as const, cap: 18.0, weight: 0.23 / 6 })),
  ...["B04", "B11", "B19", "B27"].map((n) => ({ id: `WGN-${n}`, type: "open" as const, cap: 22.0, weight: 0.15 / 4 })),
  ...Array.from({ length: 14 }, (_, i) => ({ id: `WGN-D${String(i + 1).padStart(2, "0")}`, type: "container" as const, cap: 48.0, weight: 0.62 / 14 })),
];

/** 최저톤수율(품목 공통 0.80) 위로 실어야 운임계산톤수가 실적재량으로 잡힙니다. */
const MIN_LOAD_RATE = 0.86;
const MAX_LOAD_RATE = 0.96;

// ── 재현 가능한 난수 (mulberry32) ──────────────────────────────

function rng(seedValue: number) {
  let a = seedValue >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260813);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

function pickWeighted<T extends { weight: number }>(xs: readonly T[]): T {
  let r = rand() * xs.reduce((s, x) => s + x.weight, 0);
  for (const x of xs) if ((r -= x.weight) <= 0) return x;
  return xs[xs.length - 1];
}

// ── 원장 구조 ──────────────────────────────────────────────────

interface Member {
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
  members: Member[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 로트 1건의 편익. 집계(`aggregate`)와 같은 경로 — 화주별로 따로 계산해 더합니다. */
function memberBenefit(trip: Trip, m: Member): number {
  return computeBenefit({
    totalTon: m.weightTon,
    railDistanceKm: RAIL_KM,
    roadDirectDistanceKm: m.roadDirectDistanceKm,
    shuttleDistanceKm: m.shuttleKm,
    wagonCapacityTon: trip.wagonCapacityTon,
    memberCount: 1,
  }).totalBenefitKrw;
}

function tripBenefit(trip: Trip): number {
  return trip.members.reduce((sum, m) => sum + memberBenefit(trip, m), 0);
}

/** 톤당 편익 — 목표 물량을 역산할 때 씁니다. 화주마다 거리가 달라 값이 다릅니다. */
function benefitPerTon(s: (typeof SHIPPERS)[number]): number {
  return computeBenefit({
    totalTon: 1,
    railDistanceKm: RAIL_KM,
    roadDirectDistanceKm: s.roadKm,
    shuttleDistanceKm: s.shuttleKm,
    wagonCapacityTon: 48,
    memberCount: 1,
  }).totalBenefitKrw;
}

const AVG_BENEFIT_PER_TON = SHIPPERS.reduce((s, sh) => s + benefitPerTon(sh) * sh.share, 0);

// ── 영업일 ─────────────────────────────────────────────────────

/** 일요일은 뺍니다 (코레일 화물 간선은 토요일까지 운행). */
function businessDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ── 편성 생성 ──────────────────────────────────────────────────

const lotSeq = new Map<string, number>();

function nextLotId(date: string, letter: string): string {
  const key = `${date}-${letter}`;
  const n = (lotSeq.get(key) ?? 0) + 1;
  lotSeq.set(key, n);
  return `LOT-${date.replace(/-/g, "")}-${letter}${String(n).padStart(2, "0")}`;
}

function makeTrip(id: string, date: string): Trip {
  const wagon = pickWeighted(FLEET);
  const load = wagon.cap * between(MIN_LOAD_RATE, MAX_LOAD_RATE);

  // 로트 수 — 화차가 클수록 더 많은 화주가 함께 탑니다. 이게 합적의 정의입니다.
  const lotCount = wagon.cap >= 40 ? (rand() < 0.45 ? 4 : 3) : rand() < 0.35 ? 4 : 3;

  // 화주 배정. 같은 화주가 한 편성에 로트를 둘 개 실을 수 있습니다 (기존 원장도 그렇습니다).
  const picks = Array.from({ length: lotCount }, () => pickWeighted(SHIPPERS.map((s) => ({ ...s, weight: s.share }))));

  // 적재 총량을 로트로 쪼갭니다. 균등분할 뒤 ±25% 흔들고 다시 정규화합니다.
  const jitter = picks.map(() => between(0.75, 1.25));
  const scale = load / jitter.reduce((a, b) => a + b, 0);
  const weights = jitter.map((j) => Math.max(2.0, round1(j * scale)));

  const members: Member[] = picks.map((s, i) => ({
    lotId: nextLotId(date, s.letter),
    shipperId: s.id,
    shipperName: s.name,
    category: s.category,
    weightTon: weights[i],
    shuttleKm: s.shuttleKm,
    roadDirectDistanceKm: s.roadKm,
    currentRoadFareKrw: Math.round(weights[i] * s.farePerTon),
  }));

  return {
    id,
    date,
    laneId: LANE_ID,
    originStationId: lane.originStationId,
    destStationId: lane.destStationId,
    wagonId: wagon.id,
    wagonType: wagon.type,
    wagonCapacityTon: wagon.cap,
    members,
  };
}

/** 로트 중량을 바꾸면 도로 운임도 같이 따라가야 합니다 (톤당 단가는 화주 고정). */
function setWeight(m: Member, ton: number) {
  const s = SHIPPERS.find((x) => x.id === m.shipperId)!;
  m.weightTon = round1(ton);
  m.currentRoadFareKrw = Math.round(m.weightTon * s.farePerTon);
}

/**
 * 한 분기를 목표 편익에 맞춥니다.
 *
 * 1) 톤당 편익으로 편성 수를 역산해 생성
 * 2) 전체 중량에 비율을 곱해 한 번 맞추고
 * 3) 로트 하나씩 ±0.1톤 씩 흔들어 오차를 만원 미만으로 좁힙니다
 *
 * 3) 이 필요한 이유: 편익은 항목별로 원 단위 반올림이라 비례식만으로는 정확히 안 맞습니다.
 */
function buildQuarter(prefix: string, from: string, to: string, targetKrw: number): Trip[] {
  const days = businessDays(from, to);
  const avgTripTon = FLEET.reduce((s, w) => s + w.cap * w.weight, 0) * ((MIN_LOAD_RATE + MAX_LOAD_RATE) / 2);
  const count = Math.max(1, Math.round(targetKrw / AVG_BENEFIT_PER_TON / avgTripTon));

  const trips: Trip[] = [];
  for (let i = 0; i < count; i++) {
    trips.push(makeTrip(`${prefix}-${String(i + 1).padStart(4, "0")}`, days[Math.floor((i * days.length) / count)]));
  }

  const total = () => trips.reduce((s, t) => s + tripBenefit(t), 0);

  // 2) 비례 보정 — 적재율이 최저톤수율 아래로 내려가지 않게 화차 정원으로 자릅니다.
  const ratio = targetKrw / total();
  for (const t of trips) {
    for (const m of t.members) setWeight(m, Math.max(2.0, m.weightTon * ratio));
    const sum = t.members.reduce((s, m) => s + m.weightTon, 0);
    if (sum > t.wagonCapacityTon) {
      const k = t.wagonCapacityTon / sum;
      for (const m of t.members) setWeight(m, Math.max(2.0, m.weightTon * k));
    }
  }

  // 3) 잔차 보정 — 0.1톤 단위로 한 로트씩 조정 (한 스텝이 약 1,800원).
  //    합계를 매번 다시 돌리면 수만 번 × 수천 로트라 안 끝납니다. 건드린 로트의
  //    차액만 누계에 반영합니다.
  //    목표를 만원 단위 **위쪽**으로 겨냥합니다. 랜딩 라벨은 만원 미만을 버리므로
  //    341,999,492원은 "3억 4,199만"으로 찍힙니다. 딱 아래로 떨어지면 안 됩니다.
  const aim = targetKrw + 4_000;
  let cur = total();
  for (let guard = 0; guard < 200_000; guard++) {
    const gap = aim - cur;
    if (Math.abs(gap) < 1_000) break;
    const step = gap > 0 ? 0.1 : -0.1;
    const t = trips[Math.floor(rand() * trips.length)];
    const m = pick(t.members);
    const next = round1(m.weightTon + step);
    const sum = round1(t.members.reduce((s, x) => s + x.weightTon, 0) + step);
    if (next < 2.0 || sum > t.wagonCapacityTon || sum < t.wagonCapacityTon * 0.8) continue;
    const before = memberBenefit(t, m);
    setWeight(m, next);
    cur += memberBenefit(t, m) - before;
  }

  return trips;
}

// ── 목표 ───────────────────────────────────────────────────────

const Q2_TARGET = 342_000_000;
/** 전 분기 대비 +38%. 랜딩 히어로 옆 배지가 이 값으로 찍힙니다. */
const Q1_TARGET = Math.round(Q2_TARGET / 1.38);

/** 진행 중 분기(Q3) — 원장은 기준일 이틀 전까지, 목표는 기준일까지의 일수 비례에 성장분 10%. */
const Q3_START = "2026-07-01";
const Q3_END = shiftDate(BASE_DATE, -2) < Q3_START
  ? Q3_START
  : shiftDate(BASE_DATE, -2) > "2026-09-30"
    ? "2026-09-30"
    : shiftDate(BASE_DATE, -2);
const Q3_ELAPSED_DAYS = Math.min(92, calendarDaysInclusive(Q3_START, BASE_DATE));
const Q3_TARGET = Math.round((Q2_TARGET / 91) * 1.1 * Q3_ELAPSED_DAYS);

const trips = [
  ...buildQuarter("TRP-2026Q1", "2026-01-01", "2026-03-31", Q1_TARGET),
  ...buildQuarter("TRP-2026Q2", "2026-04-01", "2026-06-30", Q2_TARGET),
  ...buildQuarter("TRP-2026Q3", Q3_START, Q3_END, Q3_TARGET),
];

const ledger = {
  meta: {
    schemaVersion: "1.0.0",
    baseDate: BASE_DATE,
    fictional: true,
    notes: [
      "K-ESG 리포트(#40~#42)가 집계하는 '확정 수송 실적 원장'입니다. 시연용 가상 데이터입니다.",
      "seed.json 은 '지금 매칭 대기 중인 화물'을, 이 파일은 '이미 수송이 끝난 과거 실적'을 담습니다. 역할이 다르므로 파일을 분리했습니다.",
      "계수(배출원단위·사회적비용)는 여기 없습니다. BE/src/constants.ts 한 곳에만 둡니다.",
      "실제 서비스에서는 코레일 배차 확정 이력 DB가 이 자리를 대체합니다.",
      "손으로 쓰지 않고 scripts/gen-ledger.ts 가 생성합니다. 금액을 적어 넣은 곳은 한 군데도 없고, computeBenefit 을 그대로 불러 분기 편익이 목표에 닿을 때까지 물량만 조정합니다.",
      "직접 편집하지 마십시오. 규모를 바꾸려면 생성기의 목표 금액을 고치고 다시 돌리십시오.",
    ],
  },
  trips,
};

writeFileSync(new URL("../BE/src/esg/ledger.json", import.meta.url), `${JSON.stringify(ledger, null, 1)}\n`);

// ── 요약 ───────────────────────────────────────────────────────

for (const [label, prefix] of [["2026Q1", "TRP-2026Q1"], ["2026Q2", "TRP-2026Q2"], ["2026Q3", "TRP-2026Q3"]] as const) {
  const q = trips.filter((t) => t.id.startsWith(prefix));
  const ton = q.reduce((s, t) => s + t.members.reduce((a, m) => a + m.weightTon, 0), 0);
  const krw = q.reduce((s, t) => s + tripBenefit(t), 0);
  const rate = q.reduce((s, t) => s + t.members.reduce((a, m) => a + m.weightTon, 0) / t.wagonCapacityTon, 0) / q.length;
  console.log(
    `${label}  편성 ${String(q.length).padStart(4)} · 로트 ${String(q.reduce((s, t) => s + t.members.length, 0)).padStart(5)} · ` +
      `${ton.toFixed(1).padStart(9)}톤 · 적재율 ${(rate * 100).toFixed(1)}% · 편익 ${krw.toLocaleString("ko-KR").padStart(13)}원`,
  );
}
console.log(`합계   편성 ${trips.length} · 로트 ${trips.reduce((s, t) => s + t.members.length, 0)}`);

// ── seed.json 동기화 ───────────────────────────────────────────
//
// 원장을 다시 생성하면 seed.json 의 협약·계약 물량이 낡습니다. 손으로 찾아 고치라고
// 하면 반드시 한 군데를 빠뜨리므로 (실제로 화주 계약 3건이 빠져 이행률 만%가 찍혔습니다)
// 여기서 원장 실적으로 역산해 **seed.json 을 직접 패치**합니다.
//
//   화주 계약(contractTon) = 협약기간 실적 ÷ 목표 이행률
//     SHP-A 0.95 (정상) · SHP-B 0.72 (미달 위험 시나리오) · SHP-C 1.05 (초과 달성)
//   협약(contracts) = 분기 실적 ÷ 이행률 (1차 0.908 · 2차 0.694 — 기존 화면 수치 유지)
//
// dashboard 블록(Q2 상수 사본)은 Q2 목표가 고정이라 재생성해도 안 낡습니다.
// (전면 DB 전환 후 dashboard 가 라이브 집계로 바뀌면 그 사본 자체가 사라집니다.)

// 집계는 **방금 쓴 파일**을 다시 읽어서 냅니다 (period.ts 가 ledger.json 을 모듈
// 로드 시점에 읽으므로, 위에서 정적 import 하면 낡은 원장이 잡힙니다).
void (async () => {
  const { resolveAggregate } = await import("../BE/src/esg/query");
  const q2 = resolveAggregate({ period: "2026Q2" });
  const q1 = resolveAggregate({ period: "2026Q1" });
  const q3 = resolveAggregate({ period: "2026Q3" });
  const round100 = (n: number) => Math.round(n / 100) * 100;

  // 화주별 협약기간(04-01 ~ 09-30) 실적 — 원장에서 직접 합산
  const shipperActual = new Map<string, number>();
  for (const t of trips) {
    if (t.date < "2026-04-01" || t.date > "2026-09-30") continue;
    for (const m of t.members) {
      shipperActual.set(m.shipperId, (shipperActual.get(m.shipperId) ?? 0) + m.weightTon);
    }
  }

  /** 목표 이행률 — 화주영업 화면의 상태 배지 시나리오를 만든다. */
  const TARGET_RATE: Record<string, number> = { "SHP-A": 0.95, "SHP-B": 0.72, "SHP-C": 1.05 };

  const seedPath = new URL("../BE/src/seed.json", import.meta.url);
  let seedText = readFileSync(seedPath, "utf8");

  /** anchor 문자열 뒤에 처음 나오는 `"key": <숫자>` 를 교체한다. 못 찾으면 즉시 실패. */
  function patchNumberAfter(anchor: string, key: string, value: number) {
    const at = seedText.indexOf(anchor);
    if (at < 0) throw new Error(`seed.json 에서 anchor 를 찾지 못했습니다: ${anchor}`);
    const re = new RegExp(`("${key}":\\s*)-?[\\d.]+`);
    const rest = seedText.slice(at);
    if (!re.test(rest)) throw new Error(`seed.json 에서 ${anchor} 뒤의 ${key} 를 찾지 못했습니다`);
    seedText = seedText.slice(0, at) + rest.replace(re, `$1${value}`);
  }

  const patched: string[] = [];
  for (const s of SHIPPERS) {
    const actual = shipperActual.get(s.id) ?? 0;
    const ton = round100(actual / TARGET_RATE[s.id]);
    patchNumberAfter(`"no": "KLARU-2026-0412-${s.letter}"`, "contractTon", ton);
    patched.push(`${s.id} contractTon ${ton} (실적 ${actual.toFixed(1)}t → 이행률 ${((actual / ton) * 100).toFixed(1)}%)`);
  }
  const c1 = round100(q1.totalTon / 0.908);
  const c2 = round100((q2.totalTon + q3.totalTon) / 0.694);
  patchNumberAfter(`"no": "KLARU-2026-0108"`, "contractTon", c1);
  patchNumberAfter(`"no": "KLARU-2026-0412"`, "contractTon", c2);
  patched.push(`contracts[0] contractTon ${c1} · contracts[1] contractTon ${c2}`);
  patchNumberAfter(`"cumulative"`, "filledWagons", trips.length);
  patched.push(`dashboard.cumulative.filledWagons ${trips.length}`);

  writeFileSync(seedPath, seedText);

  console.log(`
── BE/src/seed.json 자동 패치 완료 ──────────────────────────────
  ${patched.join("\n  ")}

── 참고 (dashboard 블록 검산용 · Q2 고정 목표라 재생성에도 불변) ─
  dashboard.benefit.totalBenefitKrw   ${q2.totalBenefitKrw}
  dashboard.subsidyEstimate.amount    ${Math.round(q2.totalBenefitKrw * 0.3)}  (편익의 30% — 고시상 상한 B)
  전 분기 대비                        +${Math.round(((q2.totalBenefitKrw - q1.totalBenefitKrw) / q1.totalBenefitKrw) * 100)}%
`);
})();
