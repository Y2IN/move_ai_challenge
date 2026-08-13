/**
 * 인메모리 화물 스토어 — 시연·개발 전용.
 *
 * 사용자가 화면(디자인 04a)에서 등록한 화물을 프로세스 메모리에 담습니다.
 * 서버를 재시작하면 비워집니다. DB 로 교체할 땐 이 모듈만 바꾸면 됩니다.
 * (Next dev 서버는 HMR 시 모듈이 다시 평가되며 초기화될 수 있습니다.)
 *
 * ⚠️ 매칭 풀과의 관계: `match()` 는 여전히 "시드 풀 + 방금 등록한 1건" 으로
 *    편성을 계산합니다. 시연 시나리오(14/18톤 → 반드시 미달)를 보존하기 위해
 *    이 스토어의 누적 화물은 매칭 풀에 섞지 않고, 목록(#13) 표시용으로만 씁니다.
 */

import { match, normalizeInput } from "./matching";
import type { MatchCandidate, MatchResult } from "./matching";
import { accept } from "./negotiate";
import type { NegotiationResult } from "./negotiate";
import { seed } from "./seed";
import type {
  CalcResult,
  CompanyGrade,
  EmptyWagon,
  ItemCategory,
  SeedData,
  Shipment,
  ShipmentInput,
  TransportArrangement,
} from "./types";

const CATEGORIES: readonly ItemCategory[] = [
  "석유화학제품",
  "화학원료",
  "철강재",
  "기타",
];
const GRADES: readonly CompanyGrade[] = ["sme", "excellentLogistics", "general"];
const ARRANGEMENTS: readonly TransportArrangement[] = ["consignment", "own"];

// ── 스토어 상태 ────────────────────────────────────────────────

/** 등록 화물은 원본 입력·정규화된 Shipment·발급 seq 를 함께 보관한다 (부분 수정 시 merge 재검증·id 재발급용). */
interface StoredShipment {
  input: ShipmentInput;
  shipment: Shipment;
  seq: number;
}
/**
 * ⚠️ 모듈 최상위에 배열을 그냥 두면 안 된다.
 *
 * Next 는 라우트 핸들러마다 서버 번들을 따로 만든다. 그러면 이 모듈도 번들마다
 * 한 벌씩 생겨서 `POST /api/freights` 가 채운 배열과 `PATCH·DELETE /api/freights/{id}`
 * 가 읽는 배열이 **서로 다른 객체**가 된다. 방금 등록한 화물이 수정·삭제(#14/#15)에서
 * 곧바로 404 로 나온다. (report/store.ts 에서 이미 한 번 밟은 사고다)
 *
 * globalThis 에 한 번만 매달아 번들이 몇 벌이든 같은 저장소를 보게 한다.
 * (콜드 스타트마다 비워지는 건 그대로다 — 영속이 필요하면 이 파일만 교체한다)
 */
interface ShipmentStoreState {
  registered: StoredShipment[];
  seq: number;
  /** 확정된 편성(코레일 공차 수송 확정) 기록 */
  confirmations: Confirmation[];
  confirmSeq: number;
  /** 조율(negotiation) 세션 기록 (#25 조회 · #26 취소) */
  negotiations: StoredNegotiation[];
  negSeq: number;
}

const globalRef = globalThis as typeof globalThis & {
  __railhubShipmentStore?: ShipmentStoreState;
};

const state: ShipmentStoreState = (globalRef.__railhubShipmentStore ??= {
  registered: [],
  seq: 0,
  confirmations: [],
  confirmSeq: 0,
  negotiations: [],
  negSeq: 0,
});

// 배열은 참조를 그대로 쓴다 (push/splice/length=0 모두 같은 객체를 건드린다).
// 카운터는 재대입이 필요하므로 `state.seq` 처럼 state 를 거쳐 쓴다.
const registered = state.registered;
const confirmations = state.confirmations;
const negotiations = state.negotiations;

/** 입력 + 발급 seq 로 Shipment 를 만든다. id·shipperId 규칙을 등록/수정이 공유한다. */
function buildShipment(input: ShipmentInput, n: number, data: SeedData): Shipment {
  return {
    ...normalizeInput(input, data),
    id: `SHM-USER-${String(n).padStart(3, "0")}`,
    // 상호를 준 경우에만 화주도 별도로 구분해 둔다 (목록에서 구별 가능하도록).
    shipperId: input.shipperName ? `SHP-USER-${n}` : "SHP-USER",
  };
}

/** 등록: 입력을 Shipment 로 정규화해 스토어에 넣고, 만들어진 레코드를 돌려줍니다. */
export function registerShipment(input: ShipmentInput, data: SeedData = seed): Shipment {
  state.seq += 1;
  const shipment = buildShipment(input, state.seq, data);
  registered.push({ input, shipment, seq: state.seq });
  return shipment;
}

/** 등록된 화물 목록 — 최근 등록이 앞으로 오도록 뒤집어 반환합니다. */
export function listShipments(): Shipment[] {
  return registered.map((r) => r.shipment).reverse();
}

export function getShipment(id: string): Shipment | null {
  return registered.find((r) => r.shipment.id === id)?.shipment ?? null;
}

export type UpdateResult =
  | { status: "updated"; shipment: Shipment }
  | { status: "notFound" }
  | { status: "invalid"; errors: Record<string, string> };

/**
 * 부분 수정 (#14). patch 는 ShipmentInput 의 일부. 저장된 원본 입력에 덮어써
 * 전체를 다시 검증·정규화한 뒤 같은 id 로 교체한다.
 */
export function updateShipment(
  id: string,
  patch: unknown,
  data: SeedData = seed,
): UpdateResult {
  const record = registered.find((r) => r.shipment.id === id);
  if (!record) return { status: "notFound" };

  const p = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const merged = { ...record.input, ...p };
  const v = validateShipmentInput(merged, data);
  if (!v.ok || !v.value) return { status: "invalid", errors: v.errors };

  // 등록과 같은 규칙(buildShipment)으로 재발급 — id 는 seq 로 동일하게 유지되고,
  // shipperName 을 새로 넣으면 shipperId 도 등록 경로와 일관되게 바뀐다.
  const shipment = buildShipment(v.value, record.seq, data);
  record.input = v.value;
  record.shipment = shipment;
  return { status: "updated", shipment };
}

/** 삭제 (#15). 있으면 지우고 true, 없으면 false. */
export function deleteShipment(id: string): boolean {
  const i = registered.findIndex((r) => r.shipment.id === id);
  if (i === -1) return false;
  registered.splice(i, 1);
  return true;
}

/** 테스트·시연 리셋용 */
export function clearShipments(): void {
  registered.length = 0;
  state.seq = 0;
  confirmations.length = 0;
  state.confirmSeq = 0;
  negotiations.length = 0;
  state.negSeq = 0;
}

// ── 편성 확정 (#19) ────────────────────────────────────────────

export interface Confirmation {
  groupId: string;
  status: "confirmed";
  wagon: EmptyWagon;
  members: MatchCandidate[];
  totalTon: number;
  capacityTon: number;
  loadFactor: number;
  confirmedAt: string;
  calc: CalcResult | null;
}

export type ConfirmResult =
  | { status: "confirmed"; confirmation: Confirmation }
  | { status: "notMatched"; match: MatchResult };

/**
 * 코레일 공차 수송 확정 (#19). 입력/조율수락으로 매칭을 다시 돌려 `matched` 일 때만
 * 편성을 확정 기록한다. 미성립(shortfall/noWagon)이면 매칭 결과를 그대로 돌려준다.
 */
export function confirmMatch(
  input: ShipmentInput | null,
  acceptedShipmentIds: string[] = [],
  data: SeedData = seed,
): ConfirmResult {
  // 조율 수락분이 있으면 negotiate.accept() 로 재매칭 (예정 물량 당김), 없으면 그대로 매칭.
  const result = acceptedShipmentIds.length
    ? accept(data, input, acceptedShipmentIds).result
    : match(data, input);

  if (result.status !== "matched" || !result.wagon) {
    return { status: "notMatched", match: result };
  }

  state.confirmSeq += 1;
  const confirmation: Confirmation = {
    groupId: `GRP-${String(state.confirmSeq).padStart(3, "0")}`,
    status: "confirmed",
    wagon: result.wagon,
    members: result.members,
    totalTon: result.totalTon,
    capacityTon: result.capacityTon,
    loadFactor: result.loadFactor,
    confirmedAt: new Date().toISOString(),
    calc: result.calc,
  };
  confirmations.push(confirmation);
  return { status: "confirmed", confirmation };
}

// ── 조율 세션 (#25 조회 · #26 취소) ────────────────────────────

export interface StoredNegotiation {
  id: string;
  status: "open" | "cancelled";
  result: NegotiationResult;
  createdAt: string;
}

/** 조율 실행 결과를 저장하고 NEG-NNN id 를 발급한다 (#22 run 이 호출). */
export function saveNegotiation(result: NegotiationResult): StoredNegotiation {
  state.negSeq += 1;
  const record: StoredNegotiation = {
    id: `NEG-${String(state.negSeq).padStart(3, "0")}`,
    status: "open",
    result,
    createdAt: new Date().toISOString(),
  };
  negotiations.push(record);
  return record;
}

/** #25 — 조율 세션(최종 편성 결과) 조회. 없으면 null. */
export function getNegotiation(id: string): StoredNegotiation | null {
  return negotiations.find((n) => n.id === id) ?? null;
}

/** #26 — 조율 취소("다음 공차 일정 대기"). 상태만 cancelled 로. 없으면 null. */
export function cancelNegotiation(id: string): StoredNegotiation | null {
  const record = negotiations.find((n) => n.id === id);
  if (!record) return null;
  record.status = "cancelled";
  return record;
}

// ── 입력 검증 ──────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  /** 필드명 → 사람이 읽을 수 있는 오류 메시지 */
  errors: Record<string, string>;
  /** 검증을 통과했을 때만 채워지는 정규화된 입력 */
  value: ShipmentInput | null;
}

/**
 * 화물 등록 폼(04a)의 원시 요청 본문을 검증하고 `ShipmentInput` 으로 정규화합니다.
 * 실패하면 필드별 오류를 모아 돌려주므로 화면에서 각 입력 아래에 바로 표시할 수 있습니다.
 */
export function validateShipmentInput(
  body: unknown,
  data: SeedData = seed,
): ValidationResult {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const stationIds = new Set(data.stations.map((s) => s.id));

  const originStationId = str(b.originStationId);
  if (!originStationId) errors.originStationId = "출발역을 선택하세요.";
  else if (!stationIds.has(originStationId))
    errors.originStationId = `등록되지 않은 역 코드입니다: ${originStationId}`;

  const destStationId = str(b.destStationId);
  if (!destStationId) errors.destStationId = "도착역을 선택하세요.";
  else if (!stationIds.has(destStationId))
    errors.destStationId = `등록되지 않은 역 코드입니다: ${destStationId}`;

  if (originStationId && originStationId === destStationId && !errors.destStationId)
    errors.destStationId = "출발역과 도착역이 같습니다.";

  const category = b.category as ItemCategory;
  if (!CATEGORIES.includes(category))
    errors.category = `품목은 ${CATEGORIES.join(" / ")} 중 하나여야 합니다.`;

  const companyGrade = b.companyGrade as CompanyGrade;
  if (!GRADES.includes(companyGrade))
    errors.companyGrade = "기업 구분이 올바르지 않습니다.";

  const transportArrangement = b.transportArrangement as TransportArrangement;
  if (!ARRANGEMENTS.includes(transportArrangement))
    errors.transportArrangement = "운송 형태는 위탁(consignment) / 자차(own) 중 하나여야 합니다.";

  const weightTon = Number(b.weightTon);
  if (!Number.isFinite(weightTon) || weightTon <= 0)
    errors.weightTon = "중량(톤)은 0보다 큰 숫자여야 합니다.";

  const desiredDepartureDate = str(b.desiredDepartureDate);
  if (!isIsoDate(desiredDepartureDate))
    errors.desiredDepartureDate = "희망 출발일 형식이 올바르지 않습니다 (YYYY-MM-DD).";

  const requiredArrivalBy = str(b.requiredArrivalBy);
  if (requiredArrivalBy && !isIsoDate(requiredArrivalBy))
    errors.requiredArrivalBy = "도착 기한 형식이 올바르지 않습니다 (YYYY-MM-DD).";

  const ok = Object.keys(errors).length === 0;
  const value: ShipmentInput | null = ok
    ? {
        originStationId,
        destStationId,
        category,
        weightTon,
        desiredDepartureDate,
        companyGrade,
        transportArrangement,
        shipperName: str(b.shipperName) || undefined,
        originShuttleKm: num(b.originShuttleKm),
        destShuttleKm: num(b.destShuttleKm),
        requiredArrivalBy: requiredArrivalBy || undefined,
        requiresCover: b.requiresCover == null ? undefined : Boolean(b.requiresCover),
        currentRoadFareKrw: num(b.currentRoadFareKrw),
        constraintText: str(b.constraintText) || undefined,
      }
    : null;

  return { ok, errors, value };
}

// ── 파싱 헬퍼 ──────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * YYYY-MM-DD 형식이면서 실재하는 날짜인지 검사한다.
 * `new Date("2026-02-30")` 는 3/2 로 롤오버되어 NaN 검사만으로는 못 거르므로,
 * UTC 로 파싱한 뒤 다시 문자열로 만들어 원본과 일치하는지 왕복 비교한다.
 */
function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
