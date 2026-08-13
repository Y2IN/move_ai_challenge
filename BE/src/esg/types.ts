/**
 * K-ESG 리포트(api_list #40~#42) 전용 타입.
 *
 * 공용 도메인 타입은 BE/src/types.ts 에 있습니다. 여기에는 ESG 공시 문맥에서만
 * 쓰는 것(수송 실적 원장 · 지표표 · Scope 3 명세 · 리포트 문단)만 둡니다.
 */

import type { ItemCategory, LegVolumes, WagonType } from "../types";

// ── 수송 실적 원장 (ledger.json) ───────────────────────────────

/** 한 편성에 실린 화주 1명의 물량 1건. Scope 3 명세의 최소 단위입니다. */
export interface LedgerMember {
  lotId: string;
  shipperId: string;
  shipperName: string;
  category: ItemCategory;
  weightTon: number;
  /** 양단 셔틀 거리 합계 (km) — 공장 위치가 화주마다 달라 개별 값입니다. */
  shuttleKm: number;
  /** 도로 직행 거리 (km) — baseline */
  roadDirectDistanceKm: number;
  /** 전환 전 실지불 도로 운임 (원) */
  currentRoadFareKrw: number;
}

/** 확정 수송 1회 = 화차 1량 = 합적 편성 1건 */
export interface LedgerTrip {
  id: string;
  /** 출발일 YYYY-MM-DD — 기간 집계의 기준입니다. */
  date: string;
  laneId: string;
  originStationId: string;
  destStationId: string;
  wagonId: string;
  wagonType: WagonType;
  wagonCapacityTon: number;
  members: LedgerMember[];
}

export interface LedgerData {
  meta: { schemaVersion: string; baseDate: string; fictional: boolean; notes: string[] };
  trips: LedgerTrip[];
}

// ── 기간 ───────────────────────────────────────────────────────

export interface EsgPeriod {
  /** 정규화된 식별자 — "2026Q2" · "2026-05" · "2026" · "custom" */
  id: string;
  /** 화면·문서에 그대로 인쇄되는 표기 — "2026년 2분기" */
  label: string;
  /** YYYY-MM-DD (포함) */
  from: string;
  /** YYYY-MM-DD (포함) */
  to: string;
}

// ── 집계 결과 ──────────────────────────────────────────────────

export type PollutantKey = "nox" | "sox" | "pm25";

export interface PollutantAmount {
  key: PollutantKey;
  label: string;
  /** 도로 직행 기준선 배출량 (kg) */
  baselineKg: number;
  /** 철도 전환 후 실제 배출량 — 간선 + 양단 셔틀 (kg) */
  actualKg: number;
  reducedKg: number;
  reductionRate: number;
}

/** Scope 3 내보내기(#42)의 한 행 = 편성 1회 × 화주 1건 */
export interface Scope3Row {
  tripId: string;
  date: string;
  shipperId: string;
  shipperName: string;
  lotId: string;
  category: ItemCategory;
  route: string;
  wagonId: string;
  wagonType: WagonType;
  weightTon: number;
  roadDirectKm: number;
  railKm: number;
  shuttleKm: number;
  roadTonKm: number;
  railTonKm: number;
  shuttleTonKm: number;
  baselineCo2Ton: number;
  actualCo2Ton: number;
  reducedCo2Ton: number;
  reductionRate: number;
  noxReducedKg: number;
  soxReducedKg: number;
  pm25ReducedKg: number;
  /** 사회환경적 편익 환산액 (원) */
  benefitKrw: number;
  coefficientVersion: string;
}

export interface BenefitBreakdownItem {
  key: string;
  label: string;
  amountKrw: number;
  source: string;
}

/** 기간 집계 — #40·#41·#42 가 전부 이 하나를 입력으로 받습니다. */
export interface EsgAggregate {
  period: EsgPeriod;
  /** 특정 화주로 좁혔으면 그 id, 전체 집계면 null */
  shipperId: string | null;
  shipperName: string | null;
  tripCount: number;
  /** 화주 건수 (편성 × 화주) */
  legCount: number;
  shipperCount: number;
  totalTon: number;
  volumes: LegVolumes;
  baselineCo2Ton: number;
  actualCo2Ton: number;
  reducedCo2Ton: number;
  reductionRate: number;
  pollutants: PollutantAmount[];
  benefitItems: BenefitBreakdownItem[];
  totalBenefitKrw: number;
  pineTrees: number;
  truckLoadsAvoided: number;
  /** 평균 적재율 — 편성 실적재 / 화차 정원 */
  avgLoadRate: number;
  rows: Scope3Row[];
  coefficientVersion: string;
  /** 계수가 1차 출처로 검증됐는지. false면 화면에 미검증 배지를 띄웁니다. */
  verified: boolean;
}

// ── K-ESG 지표표 (#40) ─────────────────────────────────────────

export type KesgIndicatorCode = "E-3-2" | "E-7-1" | "E-3-3";

export interface KesgMetric {
  label: string;
  /** 표시용으로 이미 포맷된 문자열 (예: "182.4") */
  value: string;
  unit: string;
  /** 참고 수치(기준선 등)면 true — 화면에서 흐리게 처리 */
  supplementary?: boolean;
}

export interface KesgIndicator {
  code: KesgIndicatorCode;
  /** K-ESG 가이드라인상 지표명 */
  name: string;
  /** 대응되는 국제 공시 기준 */
  frameworks: string[];
  /** 대표값 — 표의 "실적" 칸 */
  headline: string;
  headlineUnit: string;
  metrics: KesgMetric[];
  /** 산정 근거 문장 — 그대로 인쇄됩니다 */
  basis: string;
  source: string;
  verified: boolean;
}

// ── 리포트 문단 (#41) ──────────────────────────────────────────

export type EsgSectionKey =
  | "overview"
  | "scope3"
  | "airQuality"
  | "verification"
  | "outlook";

export interface EsgSection {
  key: EsgSectionKey;
  title: string;
  /** 이 문단이 대응하는 공시 기준 */
  standard: string;
  text: string;
  /**
   * 이 문장이 어디서 왔는지.
   *
   *   ai        Claude 가 생성하고 숫자 검증을 통과한 문장
   *   fallback  사전 작성 서술 초안 (인증 없음·호출 실패·검증 실패) — 재생성마다 다른 벌이 나옵니다
   *   user      **서버가 생성을 보증할 수 없는 문장** — 클라이언트가 보낸 것
   *
   * `user` 를 별도로 두는 이유: 재생성 시 클라이언트가 기존 문단을 그대로 돌려주는데,
   * 서버는 그게 정말 우리가 만든 것인지 알 방법이 없습니다. 이걸 `ai` 로 실어주면
   * 호출자가 임의 문장을 "AI 가 작성한 공시 문단"으로 둔갑시킬 수 있습니다.
   */
  source: "ai" | "fallback" | "user";
  /** 숫자 환각 검출 등 생성 과정에서 붙은 경고 */
  warnings: string[];
}

/**
 * 생성 환경 요약. "리포트가 왜 전부 폴백이지?" 를 화면에서 바로 알 수 있어야 합니다.
 * 시연 중 인증이 빠진 걸 문단 warnings 를 하나씩 열어보고 알아채면 늦습니다.
 */
export interface EsgGenerationInfo {
  /** authToken = 계정 세션, apiKey = 콘솔 키, none = 인증 없음(전 문단 폴백) */
  authMode: "authToken" | "apiKey" | "none";
  model: string;
  aiCount: number;
  fallbackCount: number;
}

export interface EsgReport {
  period: EsgPeriod;
  shipperId: string | null;
  shipperName: string | null;
  generatedAt: string;
  sections: EsgSection[];
  generation: EsgGenerationInfo;
  indicators: KesgIndicator[];
  coefficientVersion: string;
  verified: boolean;
  /** 화면 하단 고정 문구 — 아키텍처 제약을 그대로 노출합니다 */
  disclaimer: string;
}