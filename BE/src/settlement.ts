/**
 * 전환교통 협약 정산 (GET /api/settlement).
 *
 * 협약은 "얼마를 실어 나르겠다"는 약속이고, 정산은 그 약속을 **실제 실적으로
 * 다시 계산**하는 일입니다. 그래서 이 모듈은 두 곳에서만 값을 가져옵니다.
 *
 *   약속  seed.contracts — 협약번호·기간·협약물량·협약 산정액
 *   실적  esg/ledger.json — 이미 수송이 끝난 원장
 *
 * **보조금을 여기서 새로 정의하지 않습니다.** `computeSubsidy` 를 원장 건별로
 * 불러 더합니다 — 신청서(#31)·편익 화면(#27)과 같은 함수라 세 화면의 금액이
 * 갈라질 수 없습니다.
 */

import { computeBenefit, computeCost, computeSubsidy } from "./calc";
import { loadLedger } from "./db/ledger";
import { loadUniverse } from "./db/universe";
import { aggregate, customPeriod, legInput, railDistanceKm } from "./esg/period";
import type { LedgerData } from "./esg/types";
import { SUBSIDY } from "./constants";
import type { SeedData, SettlementDocument, TransportContract } from "./types";

/** 화면이 고른 협약 번호가 마스터에 없을 때 — 라우트가 400 으로 바꿉니다. */
export class UnknownContractError extends Error {}

const DAY_MS = 86_400_000;

/** 응답에 싣는 실적 명세 행 수 상한. 화면이 펴는 행 수(8)보다 넉넉히 둡니다. */
const TRIP_ROWS_LIMIT = 20;

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 협약 한 건의 기간 실적을 원장에서 계산한 결과 */
export interface ContractPerformance {
  no: string;
  name: string;
  periodFrom: string;
  periodTo: string;
  contractTon: number;
  actualTon: number;
  tripCount: number;
  /** 협약 당시 산정된 보조금 */
  contractSubsidyKrw: number;
  /** 실적으로 다시 계산한 보조금 */
  actualSubsidyKrw: number;
  /** 실적 − 협약. 음수면 감액 */
  diffKrw: number;
  status: "이행 중" | "전액지급" | "감액지급";
  current: boolean;
}

export interface AchievementView {
  actualTon: number;
  contractTon: number;
  /** 이행률 = 실적 / 협약 */
  rate: number;
  /** 기간 경과율 — 지금 도달해 있어야 할 지점 */
  elapsedRate: number;
  /** 이행률 − 경과율. 음수면 뒤처진 것 */
  gapRate: number;
  elapsedDays: number;
  totalDays: number;
  remainDays: number;
  /** 협약 완주까지 남은 물량 */
  shortTon: number;
  /** 남은 기간 동안 주당 실어야 할 물량 */
  weeklyNeedTon: number;
}

export interface RecalcView {
  /** A — 전환 추가비용 (철도 합적 − 도로 직행) */
  additionalCostKrw: number;
  /** B — 사회·환경 절감액 × 30% */
  benefitCapKrw: number;
  /** min(A, B) */
  actualSubsidyKrw: number;
  contractSubsidyKrw: number;
  diffKrw: number;
  /** 협약 산정액 대비 감액률. 증액이면 음수 */
  reductionRate: number;
  adopted: "additionalCost" | "benefitCap" | "none";
  eligible: boolean;
  note: string;
  formulaNote: string;
}

export interface TripRow {
  no: number;
  tripId: string;
  date: string;
  route: string;
  category: string;
  weightTon: number;
  /** 운송장 번호 — 원장의 lot id 가 그대로 증빙 키가 됩니다 */
  waybill: string;
}

export interface DocumentView extends SettlementDocument {
  ok: boolean;
}

export interface SettlementResponse {
  asOf: string;
  contract: TransportContract & { status: string };
  achievement: AchievementView;
  recalc: RecalcView;
  /** 앞쪽 일부만 담깁니다 (최대 `TRIP_ROWS_LIMIT` 행). 전체 규모는 `tripSummary` 를 보십시오. */
  trips: TripRow[];
  /**
   * 명세는 **화주 단위**(편성 × 화주)입니다 — 운송장이 화주별로 발행되므로
   * 증빙도 그 단위입니다. 편성 수와 다르니 둘 다 실어 보냅니다.
   *
   * `trips` 는 잘려 있으므로 접힌 줄("외 N건")의 건수·물량은 **여기서** 빼서 씁니다.
   */
  tripSummary: { legCount: number; tripCount: number; totalTon: number };
  history: ContractPerformance[];
  documents: DocumentView[];
  /** 서류가 덜 찼으면 그 사유. null 이면 보고서 생성 가능 */
  blockedReason: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);

/**
 * 협약 기간의 A·B 를 원장 건별로 계산해 더합니다.
 *
 * 편성 합계로 한 번에 계산하지 않습니다 — 셔틀 거리가 화주마다 달라서,
 * 평균으로 뭉개면 화주별 실적과 안 맞는 금액이 나옵니다. `aggregate()` 가
 * 편익을 건별로 더하는 것과 같은 이유입니다.
 */
function recalcOver(from: string, to: string, source: LedgerData, data: SeedData): {
  additionalCostKrw: number;
  benefitCapKrw: number;
  subsidyKrw: number;
  adopted: RecalcView["adopted"];
  eligible: boolean;
  note: string;
} {
  let additionalCostKrw = 0;
  let benefitCapKrw = 0;

  for (const trip of source.trips) {
    if (trip.date < from || trip.date > to) continue;
    const railKm = railDistanceKm(trip, data);
    for (const member of trip.members) {
      const input = legInput(trip, member, railKm);
      const subsidy = computeSubsidy(computeCost(input), computeBenefit(input));
      // 건별 A 는 음수일 수 있습니다(철도가 이미 싼 구간). 합계에 그대로 반영합니다 —
      // 여기서 0 으로 깎으면 협약 전체의 추가비용이 실제보다 부풀어 오릅니다.
      additionalCostKrw += subsidy.additionalCostKrw;
      benefitCapKrw += subsidy.benefitCapKrw;
    }
  }

  additionalCostKrw = round(additionalCostKrw);
  benefitCapKrw = round(benefitCapKrw);

  const eligible = additionalCostKrw > 0 && benefitCapKrw > 0;
  const subsidyKrw = eligible ? Math.min(additionalCostKrw, benefitCapKrw) : 0;
  const adopted: RecalcView["adopted"] = !eligible
    ? "none"
    : additionalCostKrw < benefitCapKrw
      ? "additionalCost"
      : "benefitCap";

  return {
    additionalCostKrw,
    benefitCapKrw,
    subsidyKrw,
    adopted,
    eligible,
    note: eligible
      ? `추가비용 ${additionalCostKrw.toLocaleString("ko-KR")}원과 편익의 ${Math.round(SUBSIDY.benefitCapRate * 100)}%인 ${benefitCapKrw.toLocaleString("ko-KR")}원 중 작은 값으로 확정됩니다.`
      : "전환 추가비용이 발생하지 않아 보조금 대상이 아닙니다. 편익은 ESG 공시 자산으로만 활용합니다.",
  };
}

/** 협약 한 건의 이행 실적. 히스토리 표의 한 줄이 됩니다. */
function performanceOf(
  contract: TransportContract,
  now: Date,
  source: LedgerData,
  data: SeedData,
): ContractPerformance {
  const agg = aggregate({ period: customPeriod(contract.periodFrom, contract.periodTo), ledger: source, data });
  const recalc = recalcOver(contract.periodFrom, contract.periodTo, source, data);
  const ongoing = iso(now) <= contract.periodTo;

  return {
    no: contract.no,
    name: contract.name,
    periodFrom: contract.periodFrom,
    periodTo: contract.periodTo,
    contractTon: contract.contractTon,
    actualTon: agg.totalTon,
    tripCount: agg.tripCount,
    contractSubsidyKrw: contract.subsidyKrw,
    actualSubsidyKrw: recalc.subsidyKrw,
    diffKrw: recalc.subsidyKrw - contract.subsidyKrw,
    status: ongoing
      ? "이행 중"
      : recalc.subsidyKrw < contract.subsidyKrw
        ? "감액지급"
        : "전액지급",
    current: ongoing,
  };
}

export async function getSettlement(
  now: Date = new Date(),
  seedData?: SeedData,
  contractNo?: string | null,
): Promise<SettlementResponse> {
  const [loaded, source] = await Promise.all([loadUniverse(), loadLedger()]);
  const data = seedData ?? loaded;
  const asOf = iso(now);

  // 진행 중인 협약이 정산 대상. 없으면 가장 최근에 끝난 것.
  const contracts = [...data.contracts].sort((a, b) => a.periodFrom.localeCompare(b.periodFrom));
  // 화면에서 협약을 고르면 그 협약으로 정산을 다시 그린다. 모르는 번호는 400 이다
  // (조용히 다른 협약을 보여주면 사용자는 자기가 고른 걸 보고 있다고 믿는다).
  const selected = contractNo?.trim()
    ? contracts.find((c) => c.no === contractNo.trim())
    : undefined;
  if (contractNo?.trim() && !selected) {
    throw new UnknownContractError(
      `알 수 없는 협약입니다: ${contractNo} (가능한 값: ${contracts.map((c) => c.no).join(", ")})`,
    );
  }
  const contract =
    selected ??
    contracts.find((c) => c.periodFrom <= asOf && asOf <= c.periodTo) ??
    contracts[contracts.length - 1];

  const agg = aggregate({ period: customPeriod(contract.periodFrom, contract.periodTo), ledger: source, data });
  const recalc = recalcOver(contract.periodFrom, contract.periodTo, source, data);

  // ── 달성률 vs 경과율 ────────────────────────────────────────
  // "73% 이행" 만으로는 잘 가고 있는지 알 수 없습니다. 기간이 얼마나 지났는지와
  // 나란히 놓아야 뒤처졌는지가 보입니다.
  const totalDays = Math.max(1, days(contract.periodFrom, contract.periodTo));
  const elapsedDays = Math.min(Math.max(days(contract.periodFrom, asOf), 0), totalDays);
  const remainDays = totalDays - elapsedDays;
  const rate = contract.contractTon > 0 ? agg.totalTon / contract.contractTon : 0;
  const elapsedRate = elapsedDays / totalDays;
  const shortTon = Math.max(0, contract.contractTon - agg.totalTon);

  const achievement: AchievementView = {
    actualTon: agg.totalTon,
    contractTon: contract.contractTon,
    rate: round3(rate),
    elapsedRate: round3(elapsedRate),
    gapRate: round3(rate - elapsedRate),
    elapsedDays,
    totalDays,
    remainDays,
    shortTon: round1(shortTon),
    // 남은 기간이 없으면 주당 필요량은 의미가 없습니다 (0 으로 두고 화면이 안 그립니다).
    weeklyNeedTon: remainDays > 0 ? round1(shortTon / (remainDays / 7)) : 0,
  };

  // ── 실적 명세 ───────────────────────────────────────────────
  //
  // **앞쪽 일부만 보냅니다.** 협약 한 건의 실적은 수천 건이고 화면은 그중 8행만
  // 펴고 나머지는 "외 N건 · 합계"로 접습니다. 전건을 실어 보내면 화면에 안 그릴
  // 수백 KB를 매번 내려보내게 됩니다. 접힌 줄에 필요한 건수·물량은 `tripSummary`
  // 가 이미 전건 기준으로 담고 있으므로 화면은 그걸로 계산합니다.
  //
  // 전건 명세가 필요한 곳은 증빙 제출이고, 그건 Scope 3 내보내기(#42)의 몫입니다.
  const trips: TripRow[] = agg.rows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, TRIP_ROWS_LIMIT)
    .map((row, i) => ({
      no: i + 1,
      tripId: row.tripId,
      date: row.date,
      route: row.route,
      category: row.category,
      weightTon: row.weightTon,
      waybill: row.lotId,
    }));

  // ── 증빙 ────────────────────────────────────────────────────
  const documents: DocumentView[] = data.settlementDocuments.map((doc) => ({
    ...doc,
    ok: !doc.required || doc.file !== null,
  }));
  const missing = documents.filter((d) => !d.ok);

  return {
    asOf,
    contract: { ...contract, status: asOf <= contract.periodTo ? "이행 중" : "종료" },
    achievement,
    recalc: {
      additionalCostKrw: recalc.additionalCostKrw,
      benefitCapKrw: recalc.benefitCapKrw,
      actualSubsidyKrw: recalc.subsidyKrw,
      contractSubsidyKrw: contract.subsidyKrw,
      diffKrw: recalc.subsidyKrw - contract.subsidyKrw,
      reductionRate:
        contract.subsidyKrw > 0
          ? round3((contract.subsidyKrw - recalc.subsidyKrw) / contract.subsidyKrw)
          : 0,
      adopted: recalc.adopted,
      eligible: recalc.eligible,
      note: recalc.note,
      formulaNote: `${SUBSIDY.legalBasis} · min(A, B)`,
    },
    trips,
    // `trips.length` 가 아니라 집계의 전건 수입니다 — trips 는 잘려 있습니다.
    tripSummary: { legCount: agg.legCount, tripCount: agg.tripCount, totalTon: agg.totalTon },
    history: contracts.map((c) => performanceOf(c, now, source, data)),
    documents,
    // 서류명 뒤에 조사를 붙이지 않습니다 — 받침에 따라 을/를이 갈리는데,
    // 서류가 추가될 때마다 그걸 신경 쓰게 됩니다.
    blockedReason: missing.length
      ? `미제출 서류 ${missing.length}건 — ${missing.map((d) => d.name).join(" · ")}`
      : null,
  };
}
