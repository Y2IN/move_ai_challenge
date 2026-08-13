/**
 * 알뜰철도 X 공용 도메인 타입.
 * 프론트(FE/app)와 백엔드(FE/app/api → BE/src)가 같은 타입을 씁니다.
 */

// ── 기준 데이터 ────────────────────────────────────────────────

export type Packaging = "pallet" | "roll" | "crate" | "container" | "bulk";
export type WagonType = "covered" | "open" | "container" | "tank";

/** 화물 등록 폼(디자인 04a)의 "품목" 셀렉트 */
export type ItemCategory = "석유화학제품" | "화학원료" | "철강재" | "기타";

/** 화물 등록 폼(디자인 04a)의 "기업 구분" — 전환교통 고시상 우대 등급 */
export type CompanyGrade = "sme" | "excellentLogistics" | "general";

export interface Station {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  handling: string[];
}

export interface Lane {
  id: string;
  originStationId: string;
  destStationId: string;
  railDistanceKm: number;
  /** 도로 직행 거리(baseline). 철도 거리와 다릅니다. */
  roadDistanceKm: number;
  transitHours: number;
}

export interface Shipper {
  id: string;
  name: string;
  industry: string;
  companyGrade: CompanyGrade;
  esgDisclosureRequired: boolean;
  contact: { manager: string; role: string; email: string };
}

// ── 화물 ───────────────────────────────────────────────────────

export type ShipmentStatus =
  | "requested" // 접수됨 · 매칭 대기
  | "scheduled" // 미래 예정 물량 · 조율로 당길 수 있는 후보
  | "pooled" // 합적 편성에 배정됨
  | "confirmed"; // 코레일 배차 확정

export interface Cargo {
  description: string;
  category: ItemCategory;
  weightTon: number;
  volumeCbm: number;
  packaging: Packaging;
  hazmat: boolean;
  requiresCover: boolean;
  requiresRefrigeration: boolean;
}

/** AI가 constraintText 에서 뽑아내는 구조화 제약. /api/parse 가 채웁니다. */
export interface ParsedConstraints {
  hard: string[];
  soft: string[];
  departureFlexDays: number;
  hardArrivalBy: string | null;
  mustBeCovered: boolean;
  noWeekendDispatch: boolean;
}

/** Claude 호출이 실패했을 때 쓰는 규칙기반 폴백 값 (시드에 미리 넣어 둠) */
export type FallbackHints = Omit<ParsedConstraints, "hard" | "soft"> & {
  requiresForklift: boolean;
};

export interface Shipment {
  id: string;
  shipperId: string;
  status: ShipmentStatus;
  pullForwardEligible?: boolean;
  cargo: Cargo;
  origin: { name: string; address: string; stationId: string; shuttleKm: number };
  destination: { name: string; address: string; stationId: string; shuttleKm: number };
  schedule: { requestedDepartureDate: string; requiredArrivalBy: string };
  currentMode: "road" | "rail";
  roadDirectDistanceKm: number;
  /** 화주가 지금 실제로 내고 있는 도로 운임 (baseline). 소량일수록 톤당 단가가 높습니다. */
  currentRoadFareKrw: number;
  constraintText: string;
  parsedConstraints: ParsedConstraints | null;
  fallbackHints: FallbackHints;
}

export interface EmptyWagon {
  id: string;
  label: string;
  wagonType: WagonType;
  capacityTon: number;
  capacityCbm: number;
  capacityBasis: string;
  laneId: string;
  departure: { stationId: string; date: string; dayOfWeek: string; time: string };
  arrival: { stationId: string; date: string; dayOfWeek: string; time: string };
  emptyReason: string;
  handling: string[];
}

export interface SeedData {
  meta: Record<string, unknown>;
  stations: Station[];
  lanes: Lane[];
  shippers: Shipper[];
  shipments: Shipment[];
  emptyWagons: EmptyWagon[];
}

// ── 사용자 입력 (디자인 04a 화물 등록 폼) ──────────────────────

/**
 * 화면에서 사용자가 직접 채우는 값. 시드 화물 풀과 합쳐서 매번 재계산합니다.
 * 자연어 입력(`/api/parse`)도 최종적으로 이 형태로 정규화됩니다.
 */
export interface ShipmentInput {
  originStationId: string;
  destStationId: string;
  category: ItemCategory;
  weightTon: number;
  desiredDepartureDate: string; // YYYY-MM-DD
  companyGrade: CompanyGrade;
  /** 선택 — 비우면 lane 거리와 원단위로 추정합니다. */
  shipperName?: string;
  originShuttleKm?: number;
  destShuttleKm?: number;
  requiredArrivalBy?: string;
  requiresCover?: boolean;
  currentRoadFareKrw?: number;
  constraintText?: string;
}

// ── 계산 결과 ──────────────────────────────────────────────────

/** 도로 baseline / 철도 actual 각각의 물리량 */
export interface LegVolumes {
  /** 도로 직행 ton·km (baseline) */
  roadDirectTonKm: number;
  /** 철도 간선 ton·km */
  railTonKm: number;
  /** 양단 셔틀 도로 ton·km */
  shuttleTonKm: number;
}

export interface BenefitItem {
  key: "ghg" | "airPollution" | "accident" | "congestion" | "roadWear";
  label: string;
  /** 물리 감축량 표기 (예: "182 tCO₂eq") */
  quantity: string;
  amountKrw: number;
  source: string;
}

export interface BenefitResult {
  volumes: LegVolumes;
  /** 도로 단독 배출량 (tCO₂eq) */
  roadCo2Ton: number;
  /** 철도 전환 후 배출량 — 간선 + 양단 셔틀 (tCO₂eq) */
  railCo2Ton: number;
  co2ReducedTon: number;
  co2ReducedRate: number;
  items: BenefitItem[];
  totalBenefitKrw: number;
  /** 환산 표현 */
  pineTrees: number;
  truckLoadsAvoided: number;
}

export interface CostResult {
  /** baseline — 전 구간 도로 직행. 화주 실지불 운임이 있으면 그 값입니다. */
  roadOnlyKrw: number;
  /** 참고 — 만재 트럭 원단위로 환산한 도로 운임. 소량 화물은 실지불이 이보다 훨씬 비쌉니다. */
  roadBenchmarkKrw: number;
  /** 합적 없이 화주가 각자 화차 1량씩 잡았을 때 (최저톤수를 인원수만큼 부담) */
  railSoloKrw: number;
  /** 합적 후 철도 (간선 + 상하역 + 셔틀) */
  railPooledKrw: number;
  breakdown: { railLineHaulKrw: number; handlingKrw: number; shuttleKrw: number };
  /** 합적 효과 = railSolo − railPooled. 화면의 "합적 단가 N% 인하"가 이것입니다. */
  poolingSavingKrw: number;
  poolingSavingRate: number;
}

export interface SubsidyResult {
  /** A = 철도 합적 비용 − 도로 직행 비용. 음수면 보조금 대상이 아닙니다. */
  additionalCostKrw: number;
  /** B = 사회환경적 편익 × 30% (고시 상한) */
  benefitCapKrw: number;
  /** min(A, B). A ≤ 0 이면 0 */
  subsidyKrw: number;
  adopted: "additionalCost" | "benefitCap" | "none";
  eligible: boolean;
  /** 보조금 반영 후 화주 실부담 */
  netCostKrw: number;
  /** 도로 직행 대비 최종 이득 (음수면 여전히 비쌈) */
  vsRoadKrw: number;
  note: string;
}

export interface CalcResult {
  benefit: BenefitResult;
  cost: CostResult;
  subsidy: SubsidyResult;
}