/**
 * 기간 파싱 + 수송 실적 집계.
 *
 * #40(지표표) · #41(리포트) · #42(내보내기) 는 전부 여기서 나온 `EsgAggregate`
 * 하나만 입력으로 받습니다. 집계 규칙을 고칠 일이 생기면 이 파일만 고치면 됩니다.
 *
 * **배출량 계산식을 여기에 다시 쓰지 않습니다.** `calc.ts` 의 `computeBenefit` 를
 * 화주 1건 단위로 호출해서 그 결과를 더합니다. 계산식이 전부 ton·km 에 선형이라
 * 쪼개서 더한 값과 한 번에 계산한 값이 같습니다. 계수가 바뀌어도 자동으로 따라옵니다.
 */

import { computeBenefit, type CalcInput } from "../calc";
import {
  AIR_POLLUTANT_LABEL,
  COEFFICIENT_VERSION,
  PINE_CO2_KG_PER_TREE_YEAR,
  TRUCK_CAPACITY_TON,
  VERIFIED,
} from "../constants";
import { todayYmd } from "../roll";
import { seed } from "../seed";
import type { SeedData } from "../types";
import { computePollutants, emptyPollutantTotals, type PollutantTotals } from "./emissions";
import ledgerRaw from "./ledger.json";
import type {
  BenefitBreakdownItem,
  EsgAggregate,
  EsgPeriod,
  LedgerData,
  LedgerMember,
  LedgerTrip,
  Scope3Row,
} from "./types";

/** JSON import 는 리터럴 유니온을 string 으로 넓혀 읽습니다. seed.ts 와 같은 이유로 한 번만 단언합니다. */
export const ledger = ledgerRaw as unknown as LedgerData;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ── 1. 기간 파싱 ───────────────────────────────────────────────

const QUARTER_RANGE: Record<number, [string, string]> = {
  1: ["01-01", "03-31"],
  2: ["04-01", "06-30"],
  3: ["07-01", "09-30"],
  4: ["10-01", "12-31"],
};

const lastDayOfMonth = (year: number, month: number) =>
  String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0");

export class PeriodParseError extends Error {}

/**
 * `period` 쿼리스트링을 기간으로 바꿉니다.
 *
 * 받는 형식: `2026Q2` · `2026-Q2` · `2026-05` · `2026`
 * 비워두면 **직전 완료 분기**로 떨어집니다. 진행 중인 분기를 공시 기준으로 쓰면
 * 다음 달에 숫자가 바뀌므로, 기본값은 항상 닫힌 기간이어야 합니다.
 */
export function parsePeriod(input?: string | null, baseDate?: string): EsgPeriod {
  const raw = (input ?? "").trim();
  // 기본값은 **직전 완료 분기**. 원장 baseDate 가 아니라 오늘을 기준으로 삼는다 —
  // 원장이 며칠 뒤처져 있어도 "지금 기준 직전 분기"가 공시 기준이다.
  if (!raw) return previousQuarter(baseDate ?? todayYmd());

  const quarter = /^(\d{4})-?[Qq]([1-4])$/.exec(raw);
  if (quarter) {
    const year = Number(quarter[1]);
    const q = Number(quarter[2]);
    const [from, to] = QUARTER_RANGE[q];
    return { id: `${year}Q${q}`, label: `${year}년 ${q}분기`, from: `${year}-${from}`, to: `${year}-${to}` };
  }

  const month = /^(\d{4})-(\d{2})$/.exec(raw);
  if (month) {
    const year = Number(month[1]);
    const m = Number(month[2]);
    if (m < 1 || m > 12) throw new PeriodParseError(`월은 01~12 사이여야 합니다: ${raw}`);
    return {
      id: `${month[1]}-${month[2]}`,
      label: `${year}년 ${m}월`,
      from: `${month[1]}-${month[2]}-01`,
      to: `${month[1]}-${month[2]}-${lastDayOfMonth(year, m)}`,
    };
  }

  const year = /^(\d{4})$/.exec(raw);
  if (year) {
    return { id: raw, label: `${raw}년`, from: `${raw}-01-01`, to: `${raw}-12-31` };
  }

  throw new PeriodParseError(
    `기간 형식을 알 수 없습니다: "${raw}" — 2026Q2 · 2026-05 · 2026 중 하나로 주세요.`,
  );
}

/** `from`·`to` 를 직접 받은 경우 (임의 구간 내보내기용) */
export function customPeriod(from: string, to: string): EsgPeriod {
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(from) || !isDate(to)) {
    throw new PeriodParseError("from·to 는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (from > to) throw new PeriodParseError("from 이 to 보다 늦습니다.");
  return { id: "custom", label: `${from} ~ ${to}`, from, to };
}

function previousQuarter(baseDate: string): EsgPeriod {
  const year = Number(baseDate.slice(0, 4));
  const q = Math.floor((Number(baseDate.slice(5, 7)) - 1) / 3) + 1;
  const prevQ = q === 1 ? 4 : q - 1;
  const prevYear = q === 1 ? year - 1 : year;
  const [from, to] = QUARTER_RANGE[prevQ];
  return {
    id: `${prevYear}Q${prevQ}`,
    label: `${prevYear}년 ${prevQ}분기`,
    from: `${prevYear}-${from}`,
    to: `${prevYear}-${to}`,
  };
}

// ── 2. 원장 → 계산 입력 ────────────────────────────────────────

/** 원장이 우리 노선 마스터에 없는 노선을 가리킬 때. 입력 오류가 아니라 데이터 정합성 오류입니다. */
export class LedgerDataError extends Error {}

/**
 * 노선을 못 찾으면 **던집니다.** `?? 0` 으로 넘기면 안 됩니다.
 *
 * railDistanceKm 이 0 이 되면 철도 간선 배출량이 통째로 0 이 되는데 기준선(도로)은
 * 그대로라, 감축량과 감축률이 부풀어 오른 채 지표표와 Scope 3 명세에 그대로 실립니다.
 * 명세에는 "철도간선거리(km) 0" 이라고 찍히지만 합계만 보는 사람은 눈치채지 못합니다.
 *
 * 모르는 화주 id 를 400 으로 막는 것과 같은 이유입니다 — 조용히 틀린 숫자를 내는 것이
 * 제일 나쁩니다. 다만 이쪽은 사용자 입력이 아니라 우리 원장의 문제라 5xx 로 갑니다.
 */
export function railDistanceKm(trip: LedgerTrip, data: SeedData = seed): number {
  const lane = data.lanes.find((l) => l.id === trip.laneId);
  if (!lane) {
    throw new LedgerDataError(
      `수송 실적 원장 ${trip.id} 의 노선 ${trip.laneId} 를 노선 마스터에서 찾을 수 없습니다. ` +
        `(등록된 노선: ${data.lanes.map((l) => l.id).join(", ")})`,
    );
  }
  return lane.railDistanceKm;
}

function routeLabel(trip: LedgerTrip, data: SeedData): string {
  const name = (id: string) => data.stations.find((s) => s.id === id)?.name ?? id;
  return `${name(trip.originStationId)} → ${name(trip.destStationId)}`;
}

/**
 * 화주 1건을 계산 입력으로 정규화합니다.
 *
 * 편성 합계가 아니라 **화주 개별 거리**로 계산합니다. 셔틀 거리가 화주마다 다르므로
 * 편성 평균으로 뭉개면 화주별 Scope 3 배출량이 자기 실적과 안 맞게 됩니다.
 */
export function legInput(trip: LedgerTrip, member: LedgerMember, railKm: number): CalcInput {
  return {
    totalTon: member.weightTon,
    railDistanceKm: railKm,
    roadDirectDistanceKm: member.roadDirectDistanceKm,
    shuttleDistanceKm: member.shuttleKm,
    wagonCapacityTon: trip.wagonCapacityTon,
    memberCount: 1,
  };
}

// ── 3. 집계 ────────────────────────────────────────────────────

export interface AggregateOptions {
  period: EsgPeriod;
  /** 특정 화주만 집계. 없으면 플랫폼 전체 */
  shipperId?: string | null;
  /**
   * 집계할 원장. 비우면 번들 ledger.json.
   * DB 경로(`db/ledger.ts` 의 loadLedger)가 여기로 주입한다 — 집계 **규칙**은
   * 그대로 두고 데이터 출처만 갈아끼우기 위한 이음매다.
   */
  ledger?: LedgerData;
  /** 노선·역·화주 마스터. 비우면 번들 seed. */
  data?: SeedData;
}

/** 원장에 실적이 하나도 없어도 예외를 던지지 않습니다. 빈 지표표가 정상 응답입니다. */
export function aggregate({
  period,
  shipperId,
  ledger: source = ledger,
  data = seed,
}: AggregateOptions): EsgAggregate {
  const targetShipper = shipperId ?? null;
  const trips = source.trips.filter((t) => t.date >= period.from && t.date <= period.to);

  const rows: Scope3Row[] = [];
  const benefitByKey = new Map<string, BenefitBreakdownItem>();
  const pollutantTotals: PollutantTotals = emptyPollutantTotals();

  let totalTon = 0;
  let roadDirectTonKm = 0;
  let railTonKm = 0;
  let shuttleTonKm = 0;
  let baselineCo2Ton = 0;
  let actualCo2Ton = 0;
  let capacityTonSum = 0;
  let loadedTonSum = 0;

  const countedTrips = new Set<string>();
  const countedShippers = new Set<string>();

  for (const trip of trips) {
    const railKm = railDistanceKm(trip, data);
    const members = targetShipper
      ? trip.members.filter((m) => m.shipperId === targetShipper)
      : trip.members;
    if (members.length === 0) continue;

    countedTrips.add(trip.id);
    // 적재율은 편성 단위 지표입니다. 화주로 좁혀도 편성 전체의 적재율을 씁니다.
    capacityTonSum += trip.wagonCapacityTon;
    loadedTonSum += trip.members.reduce((sum, m) => sum + m.weightTon, 0);

    for (const member of members) {
      countedShippers.add(member.shipperId);

      const benefit = computeBenefit(legInput(trip, member, railKm));
      const pollutant = computePollutants(benefit.volumes);

      totalTon += member.weightTon;
      roadDirectTonKm += benefit.volumes.roadDirectTonKm;
      railTonKm += benefit.volumes.railTonKm;
      shuttleTonKm += benefit.volumes.shuttleTonKm;
      baselineCo2Ton += benefit.roadCo2Ton;
      actualCo2Ton += benefit.railCo2Ton;

      for (const item of benefit.items) {
        const prev = benefitByKey.get(item.key);
        benefitByKey.set(item.key, {
          key: item.key,
          label: item.label,
          amountKrw: (prev?.amountKrw ?? 0) + item.amountKrw,
          source: item.source,
        });
      }

      for (const key of ["nox", "sox", "pm25"] as const) {
        pollutantTotals[key].baselineKg += pollutant[key].baselineKg;
        pollutantTotals[key].actualKg += pollutant[key].actualKg;
      }

      rows.push({
        tripId: trip.id,
        date: trip.date,
        shipperId: member.shipperId,
        shipperName: member.shipperName,
        lotId: member.lotId,
        category: member.category,
        route: routeLabel(trip, data),
        wagonId: trip.wagonId,
        wagonType: trip.wagonType,
        weightTon: member.weightTon,
        roadDirectKm: member.roadDirectDistanceKm,
        railKm,
        shuttleKm: member.shuttleKm,
        roadTonKm: Math.round(benefit.volumes.roadDirectTonKm),
        railTonKm: Math.round(benefit.volumes.railTonKm),
        shuttleTonKm: Math.round(benefit.volumes.shuttleTonKm),
        baselineCo2Ton: round3(benefit.roadCo2Ton),
        actualCo2Ton: round3(benefit.railCo2Ton),
        reducedCo2Ton: round3(benefit.co2ReducedTon),
        reductionRate: round3(benefit.co2ReducedRate),
        noxReducedKg: round3(pollutant.nox.reducedKg),
        soxReducedKg: round3(pollutant.sox.reducedKg),
        pm25ReducedKg: round3(pollutant.pm25.reducedKg),
        benefitKrw: benefit.totalBenefitKrw,
        coefficientVersion: COEFFICIENT_VERSION,
      });
    }
  }

  const reducedCo2Ton = baselineCo2Ton - actualCo2Ton;
  const benefitItems = [...benefitByKey.values()];
  const totalBenefitKrw = benefitItems.reduce((sum, i) => sum + i.amountKrw, 0);

  // 환산 표현은 화주별로 반올림해서 더하면 오차가 쌓입니다. 합계에서 한 번만 계산합니다.
  const pineTrees = Math.round((reducedCo2Ton * 1000) / PINE_CO2_KG_PER_TREE_YEAR);
  const truckLoadsAvoided = Math.ceil(totalTon / TRUCK_CAPACITY_TON);

  return {
    period,
    shipperId: targetShipper,
    shipperName: targetShipper
      ? (data.shippers.find((s) => s.id === targetShipper)?.name ?? targetShipper)
      : null,
    tripCount: countedTrips.size,
    legCount: rows.length,
    shipperCount: countedShippers.size,
    totalTon: round1(totalTon),
    volumes: {
      roadDirectTonKm: Math.round(roadDirectTonKm),
      railTonKm: Math.round(railTonKm),
      shuttleTonKm: Math.round(shuttleTonKm),
    },
    baselineCo2Ton: round1(baselineCo2Ton),
    actualCo2Ton: round1(actualCo2Ton),
    reducedCo2Ton: round1(reducedCo2Ton),
    reductionRate: baselineCo2Ton > 0 ? round3(reducedCo2Ton / baselineCo2Ton) : 0,
    // SOx·PM2.5 는 kg 단위로 1 미만이라 소수 1자리로 자르면 기준선−실제≠감축량이 됩니다.
    // 3자리까지 남기고 표시 자릿수는 지표표에서 정합니다.
    pollutants: (["nox", "sox", "pm25"] as const).map((key) => {
      const t = pollutantTotals[key];
      const reduced = t.baselineKg - t.actualKg;
      return {
        key,
        label: AIR_POLLUTANT_LABEL[key],
        baselineKg: round3(t.baselineKg),
        actualKg: round3(t.actualKg),
        reducedKg: round3(reduced),
        reductionRate: t.baselineKg > 0 ? round3(reduced / t.baselineKg) : 0,
      };
    }),
    benefitItems,
    totalBenefitKrw,
    pineTrees,
    truckLoadsAvoided,
    avgLoadRate: capacityTonSum > 0 ? round3(loadedTonSum / capacityTonSum) : 0,
    rows,
    coefficientVersion: COEFFICIENT_VERSION,
    verified: VERIFIED,
  };
}
