/**
 * 화물 스토어 — Supabase 우선, 인메모리 폴백.
 *
 * ── 왜 DB 를 붙였나 ──────────────────────────────────────────────
 *
 * Vercel 서버리스는 요청마다 **다른 람다 인스턴스**로 갈 수 있다.
 * `globalThis` 트릭은 한 인스턴스 안에서 번들이 여러 벌 생기는 문제만 막지,
 * 인스턴스가 갈리는 건 못 막는다. 심사위원이 화물을 등록하고 다음 날 다시 왔을 때
 * 목록이 비어 있으면 그걸로 끝이다. 그래서 영속 저장소가 필요해졌다.
 *
 * ── 이중화 ──────────────────────────────────────────────────────
 *
 * 쓰기는 **DB 와 메모리에 둘 다** 넣고, 읽기는 DB 를 먼저 본다.
 * DB 가 잠들거나(무료 플랜 7일 무활동 정지) 네트워크가 끊기면 읽기도
 * 메모리로 되돌아간다 — 그 인스턴스가 처리한 만큼은 계속 보인다.
 * 환경변수가 아예 없으면 예전과 100% 같은 동작이다.
 *
 * ── 매칭 풀과의 관계 (하이브리드) ───────────────────────────────
 *
 * 예전에는 등록 화물을 매칭 풀에서 **통째로 배제**했다. 시연 시나리오(14/18톤 →
 * 반드시 미달)를 지키려는 의도였지만, 부작용이 컸다: 화물을 아무리 등록해도
 * 화차가 채워지지 않았고 "데이터가 부족하다"는 메시지만 반복됐다. 등록이
 * 아무 영향도 주지 않는 제품은 시연으로도 설득이 안 된다.
 *
 * 이제 `buildMatchData()` 가 등록 화물을 매칭 풀에 넣는다. 대신 시나리오는
 * **화차 한 량에 가둬서** 지킨다 — `demoScenario` 플래그가 붙은 화차에는
 * 저장소 출신 화물(`fromRegistry`)이 앉지 않는다 (matching.ts 의 seatOnWagon).
 * 그래서 조율 데모용 화차는 언제나 시드 14/18톤에서 시작하고, 나머지 화차는
 * 등록이 쌓이는 만큼 실제로 차오른다.
 */

import { isDbEnabled, nextSeq } from "./db/client";
import { loadUniverse } from "./db/universe";
import {
  approveConfirmationRow,
  cancelNegotiationRow,
  clearAll as clearDb,
  deleteShipmentRecord,
  findConfirmation,
  findConfirmationByClientKey,
  findLatestConfirmation,
  findNegotiation,
  findShipmentRecord,
  insertConfirmation,
  insertNegotiation,
  insertShipment,
  listShipmentRecords,
  markShipmentsStatus,
  updateShipmentRecord,
  type ConfirmationStatus,
} from "./db/shipments";
import { DEFAULT_FLEX_DAYS, match, normalizeInput } from "./matching";
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

// ── 인메모리 미러 ──────────────────────────────────────────────

/** 등록 화물은 원본 입력·정규화된 Shipment·발급 seq 를 함께 보관한다 (부분 수정 시 merge 재검증용). */
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
 * 가 읽는 배열이 **서로 다른 객체**가 된다.
 *
 * globalThis 에 한 번만 매달아 번들이 몇 벌이든 같은 저장소를 보게 한다.
 * (DB 가 붙으면 이 배열은 폴백용 미러로만 쓰인다)
 */
interface ShipmentStoreState {
  registered: StoredShipment[];
  seq: number;
  confirmations: Confirmation[];
  confirmSeq: number;
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

/** 발급된 번호와, 그 번호가 DB 밖에서 만들어진 것인지. */
interface IssuedSeq {
  n: number;
  /**
   * true 면 **DB 에 쓰면 안 된다.** DB 는 살아 있는데 번호만 못 받은 상태라,
   * 인메모리 카운터가 낸 번호는 DB 에 이미 있는 id 와 겹친다.
   */
  localOnly: boolean;
}

/**
 * 일련번호 발급 — DB 시퀀스가 우선, 안 되면 인메모리 카운터.
 *
 * ⚠️ **"DB 가 꺼짐" 과 "DB 는 살아 있는데 시퀀스 호출만 실패" 를 구분해야 한다.**
 *
 * 후자를 똑같이 취급하면 이런 사고가 난다: DB 모드에서는 `state.seq` 가 한 번도
 * 오르지 않으므로 0 인 채인데, RPC 만 실패(스키마 캐시 미갱신·권한 누락·타임아웃)하면
 * 폴백 카운터가 1 을 내고 `SHM-USER-001` 이 다시 발급된다. 그 id 로 DB 에 insert 하면
 * PK 충돌로 조용히 무시되고(tryDb 가 삼킨다), 이후 그 id 로 들어온 수정·삭제가
 * **먼저 등록한 다른 화주의 행을 건드린다.**
 *
 * 그래서 이 경우엔 `localOnly` 를 세워 DB 쓰기를 아예 건너뛴다. 화면은 계속 동작하고
 * (그 인스턴스 메모리에는 남는다), 남의 데이터는 손대지 않는다.
 */
const SEQ_FIELD = {
  shipment: "seq",
  confirm: "confirmSeq",
  negotiation: "negSeq",
} as const;

async function issueSeq(
  kind: "shipment" | "confirm" | "negotiation",
  bump: () => number,
): Promise<IssuedSeq> {
  const fromDb = await nextSeq(kind);
  if (fromDb !== null) {
    // 폴백이 나중에 걸리더라도 이 인스턴스가 본 최댓값 위에서 시작하도록 맞춰 둔다.
    //
    // ⚠️ **kind 별 카운터에 맞춰야 한다.** 예전에는 셋 다 화물 카운터(state.seq)에
    //    넣어서, confirm·negotiation 은 DB 값과 한 번도 동기화되지 않았다. 그 상태로
    //    RPC 만 실패하면 폴백이 GRP-001 을 다시 발급하고, 조회는 DB 를 먼저 보므로
    //    **남의 편성**을 그려 준다.
    const field = SEQ_FIELD[kind];
    if (fromDb > state[field]) state[field] = fromDb;
    return { n: fromDb, localOnly: false };
  }
  return { n: bump(), localOnly: isDbEnabled() };
}

/**
 * DB 가 켜져 있는데 쓰기가 실패했는가.
 *
 * `tryDb` 는 "DB 꺼짐"과 "쿼리 실패"를 똑같이 `null` 로 만든다. 읽기는 그래도 되지만
 * **쓰기는 다르다** — 실패를 성공으로 응답하면 사용자는 저장됐다고 믿고, 다음 조회는
 * DB 를 먼저 보므로 방금 한 일이 사라진 것처럼 보인다.
 *
 * 그렇다고 500 을 내지는 않는다. 이 앱의 계약은 "DB 가 죽어도 화면은 돈다"이고,
 * 인메모리 미러 덕에 이 인스턴스에서는 실제로 계속 동작한다. 대신 `persisted: false`
 * 를 실어 보내 화면이 그 사실을 말할 수 있게 한다 (LLM 폴백의 `source` 배지와 같은 취급).
 */
function persistedOk(result: unknown, localOnly: boolean): boolean {
  if (localOnly) return false;
  if (!isDbEnabled()) return true; // 애초에 DB 를 안 쓰는 구성 — 미러가 정상 경로다
  return result !== null;
}

/** 저장 실패를 화면 문구로 옮길 때 쓰는 안내 */
export const NOT_PERSISTED_NOTE =
  "저장소에 기록하지 못했습니다 — 이 서버에서는 보이지만 다시 접속하면 사라질 수 있습니다.";

/** 입력 + 발급 seq 로 Shipment 를 만든다. id·shipperId 규칙을 등록/수정이 공유한다. */
function buildShipment(input: ShipmentInput, n: number, data: SeedData): Shipment {
  return {
    ...normalizeInput(input, data),
    id: `SHM-USER-${String(n).padStart(3, "0")}`,
    // 상호를 준 경우에만 화주도 별도로 구분해 둔다 (목록에서 구별 가능하도록).
    shipperId: input.shipperName ? `SHP-USER-${n}` : "SHP-USER",
  };
}

// ── 화물 CRUD ──────────────────────────────────────────────────

/** 등록: 입력을 Shipment 로 정규화해 저장하고, 만들어진 레코드를 돌려준다. */
/**
 * 매칭에 쓸 데이터 — 유니버스(DB 우선) + 등록 화물.
 *
 * 등록 화물에는 `fromRegistry: true` 를 달아 보낸다. 이 표시가 있어야
 * seatOnWagon 이 시나리오 화차에서 걸러낼 수 있다.
 *
 * @param excludeId 방금 등록해 따로 입력으로 넘기는 화물. 두 번 세면 톤수가 부풀어
 *                  적재율이 실제와 달라진다.
 */
export async function buildMatchData(excludeId?: string | null): Promise<SeedData> {
  const universe = await loadUniverse();
  const rows = await listShipmentRecords();
  const stored = rows ?? registered;

  const extra: Shipment[] = stored
    .filter((r) => r.shipment.id !== excludeId)
    // 이미 확정 편성에 들어간 화물은 다시 매칭에 넣지 않는다.
    .filter((r) => r.shipment.status === "requested" || r.shipment.status === "scheduled")
    .map((r) => ({
      ...r.shipment,
      fromRegistry: true,
      fallbackHints: {
        ...r.shipment.fallbackHints,
        // 유연폭 입력이 생기기 전에 등록된 화물은 0 이 박혀 있다. 그대로 쓰면
        // 화차 출발일과 날짜가 정확히 같아야만 실려서 사실상 아무 데도 못 탄다.
        // 입력에 값이 없던 건에 한해 현재 기본값(±2일)으로 본다.
        departureFlexDays:
          r.input.departureFlexDays ??
          (r.shipment.fallbackHints.departureFlexDays || DEFAULT_FLEX_DAYS),
      },
    }));

  return { ...universe, shipments: [...universe.shipments, ...extra] };
}

export async function registerShipment(
  input: ShipmentInput,
  data: SeedData = seed,
): Promise<{ shipment: Shipment; persisted: boolean }> {
  const { n, localOnly } = await issueSeq("shipment", () => (state.seq += 1));
  const shipment = buildShipment(input, n, data);
  const record: StoredShipment = { input, shipment, seq: n };

  // localOnly 면 DB 에 쓰지 않는다 — 남의 행을 덮어쓸 수 있다(issueSeq 주석 참고).
  const saved = localOnly ? null : await insertShipment(record);
  registered.push(record); // 미러 — DB 가 죽어도 이 인스턴스에서는 계속 보인다
  return { shipment, persisted: persistedOk(saved, localOnly) };
}

/** 등록된 화물 목록 — 최근 등록이 앞으로 온다. */
export async function listShipments(): Promise<Shipment[]> {
  const rows = await listShipmentRecords();
  if (rows) return rows.map((r) => r.shipment);
  return registered.map((r) => r.shipment).reverse();
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const row = await findShipmentRecord(id);
  if (row) return row.shipment;
  return registered.find((r) => r.shipment.id === id)?.shipment ?? null;
}

export type UpdateResult =
  | { status: "updated"; shipment: Shipment; persisted: boolean }
  | { status: "notFound" }
  | { status: "invalid"; errors: Record<string, string> };

/**
 * 부분 수정 (#14). patch 는 ShipmentInput 의 일부. 저장된 원본 입력에 덮어써
 * 전체를 다시 검증·정규화한 뒤 같은 id 로 교체한다.
 */
export async function updateShipment(
  id: string,
  patch: unknown,
  data: SeedData = seed,
): Promise<UpdateResult> {
  const stored =
    (await findShipmentRecord(id)) ?? registered.find((r) => r.shipment.id === id);
  if (!stored) return { status: "notFound" };

  const p = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const merged = { ...stored.input, ...p };
  const v = validateShipmentInput(merged, data);
  if (!v.ok || !v.value) return { status: "invalid", errors: v.errors };

  // 등록과 같은 규칙(buildShipment)으로 재발급 — id 는 seq 로 동일하게 유지되고,
  // shipperName 을 새로 넣으면 shipperId 도 등록 경로와 일관되게 바뀐다.
  const shipment = buildShipment(v.value, stored.seq, data);
  const next: StoredShipment = { input: v.value, shipment, seq: stored.seq };

  const saved = await updateShipmentRecord(next);
  if (saved === "notFound") return { status: "notFound" };

  // 미러도 맞춰 둔다 (DB 가 나중에 끊겨도 최신 값이 남아 있도록)
  const mirror = registered.find((r) => r.shipment.id === id);
  if (mirror) Object.assign(mirror, next);

  return { status: "updated", shipment, persisted: persistedOk(saved, false) };
}

/** 삭제 (#15). 있으면 지우고 deleted:true, 없으면 false. */
export async function deleteShipment(
  id: string,
): Promise<{ deleted: boolean; persisted: boolean }> {
  const inDb = await deleteShipmentRecord(id);

  const i = registered.findIndex((r) => r.shipment.id === id);
  if (i !== -1) registered.splice(i, 1);

  // DB 가 붙어 있으면 DB 의 판정이 우선. 폴백일 땐 미러에 있었는지로 판단한다.
  return { deleted: inDb ?? i !== -1, persisted: persistedOk(inDb, false) };
}

/** 테스트·시연 리셋용 */
export async function clearShipments(): Promise<void> {
  await clearDb();
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
  /** 확정(화주) → 승인(코레일 배차 담당자, #43) */
  status: ConfirmationStatus;
  /** 코레일이 배정을 승인한 시각. 미승인이면 null */
  approvedAt?: string | null;
  approvedBy?: string | null;
  /** 멱등 키 — 같은 키로 다시 확정 요청이 오면 새로 만들지 않고 이 편성을 돌려준다 */
  clientKey?: string | null;
  wagon: EmptyWagon;
  members: MatchCandidate[];
  totalTon: number;
  capacityTon: number;
  loadFactor: number;
  confirmedAt: string;
  calc: CalcResult | null;
}

export type ConfirmResult =
  | { status: "confirmed"; confirmation: Confirmation; persisted: boolean }
  | { status: "notMatched"; match: MatchResult };

/**
 * 코레일 공차 수송 확정 (#19). 입력/조율수락으로 매칭을 다시 돌려 `matched` 일 때만
 * 편성을 확정 기록한다. 미성립(shortfall/noWagon)이면 매칭 결과를 그대로 돌려준다.
 */
export async function confirmMatch(
  input: ShipmentInput | null,
  acceptedShipmentIds: string[] = [],
  opts: { registeredId?: string | null; clientKey?: string | null } = {},
): Promise<ConfirmResult> {
  // 같은 클라이언트 키로 이미 확정한 편성이 있으면 그걸 돌려준다.
  // 화면 새로고침·더블클릭·StrictMode 이중 실행으로 편성이 여러 개 생기던 문제를 막는다.
  if (opts.clientKey) {
    const existing = await findConfirmationByClientKey(opts.clientKey);
    if (existing) return { status: "confirmed", confirmation: existing, persisted: true };
    const mirrored = confirmations.find((c) => c.clientKey === opts.clientKey);
    if (mirrored) return { status: "confirmed", confirmation: mirrored, persisted: true };
  }

  const data = await buildMatchData(opts.registeredId ?? null);

  // 조율 수락분이 있으면 negotiate.accept() 로 재매칭 (예정 물량 당김), 없으면 그대로 매칭.
  const result = acceptedShipmentIds.length
    ? accept(data, input, acceptedShipmentIds).result
    : match(data, input);

  if (result.status !== "matched" || !result.wagon) {
    return { status: "notMatched", match: result };
  }

  const { n, localOnly } = await issueSeq("confirm", () => (state.confirmSeq += 1));
  const confirmation: Confirmation = {
    groupId: `GRP-${String(n).padStart(3, "0")}`,
    status: "confirmed",
    clientKey: opts.clientKey ?? null,
    wagon: result.wagon,
    members: result.members,
    totalTon: result.totalTon,
    capacityTon: result.capacityTon,
    loadFactor: result.loadFactor,
    confirmedAt: new Date().toISOString(),
    calc: result.calc,
  };

  const savedConfirmation = localOnly ? null : await insertConfirmation(confirmation, n);
  confirmations.push(confirmation);

  // 편성에 실린 등록 화물은 매칭 풀에서 빼야 한다. 안 그러면 이미 실려 나간
  // 화물이 다음 편성의 적재율에 계속 더해진다 (buildMatchData 의 status 필터는
  // 상태를 바꾸는 코드가 없어 그동안 아무것도 거르지 못했다).
  const memberIds = result.members.map((m) => m.shipmentId);
  await markShipmentsStatus(memberIds, "confirmed");
  for (const r of registered) {
    if (memberIds.includes(r.shipment.id)) r.shipment.status = "confirmed";
  }

  return {
    status: "confirmed",
    confirmation,
    persisted: persistedOk(savedConfirmation, localOnly),
  };
}

/**
 * 가장 최근에 확정된 편성. 없으면 null.
 *
 * 사업계획서(#31)가 "무엇을 실적으로 집계할지" 정할 때 쓴다. 이게 없으면
 * 매번 시드로 매칭을 다시 돌리게 되는데, 시연 시나리오가 일부러 정원 미달이라
 * 조율로 편성을 살려내도 보고서는 그 사실을 영영 모른다.
 */
export async function latestConfirmation(): Promise<Confirmation | null> {
  const fromDb = await findLatestConfirmation();
  if (fromDb) return fromDb;
  return confirmations.length ? confirmations[confirmations.length - 1] : null;
}

/** 편성 번호로 한 건. 확정 화면이 조회 전용으로 동작하기 위한 진입점. */
export async function getConfirmation(groupId: string): Promise<Confirmation | null> {
  const fromDb = await findConfirmation(groupId);
  if (fromDb) return fromDb;
  return confirmations.find((c) => c.groupId === groupId) ?? null;
}

export type ApproveResult =
  | { status: "approved"; confirmation: Confirmation; persisted: boolean }
  | { status: "notFound" }
  | { status: "alreadyApproved"; confirmation: Confirmation };

/**
 * 코레일 배차 승인 (#43).
 *
 * 화주 쪽 "확정"과 코레일 쪽 "승인"은 다른 사건이다. 확정은 화주가 이 편성으로
 * 가겠다는 의사이고, 승인은 코레일이 그 화차를 실제로 내주겠다는 배차 결정이다.
 * 둘을 한 상태로 뭉개면 화면에서 "누가 무엇을 기다리는 중인지" 를 못 보여준다.
 */
export async function approveConfirmation(
  groupId: string,
  approvedBy = "코레일 배차",
): Promise<ApproveResult> {
  const current = await getConfirmation(groupId);
  if (!current) return { status: "notFound" };
  if (current.status === "approved") return { status: "alreadyApproved", confirmation: current };

  const fromDb = await approveConfirmationRow(groupId, approvedBy);
  if (fromDb === "notFound") return { status: "notFound" };
  // fromDb === null 이면 DB 에 승인이 안 남았다. 미러에는 반영하되 그 사실을 알린다 —
  // 다음 조회는 DB 를 먼저 보므로 새로고침하면 다시 '확정' 으로 보인다.
  const persisted = persistedOk(fromDb, false);

  const approved: Confirmation = fromDb ?? {
    ...current,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy,
  };

  // 미러도 맞춰 둔다 (DB 가 꺼져 있어도 이 인스턴스에서는 승인 상태가 보인다)
  const mirror = confirmations.find((c) => c.groupId === groupId);
  if (mirror) Object.assign(mirror, approved);

  return { status: "approved", confirmation: approved, persisted };
}

// ── 조율 세션 (#25 조회 · #26 취소) ────────────────────────────

export interface StoredNegotiation {
  id: string;
  status: "open" | "cancelled";
  result: NegotiationResult;
  createdAt: string;
}

/** 조율 실행 결과를 저장하고 NEG-NNN id 를 발급한다 (#22 run 이 호출). */
export async function saveNegotiation(
  result: NegotiationResult,
): Promise<StoredNegotiation> {
  const { n, localOnly } = await issueSeq("negotiation", () => (state.negSeq += 1));
  const record: StoredNegotiation = {
    id: `NEG-${String(n).padStart(3, "0")}`,
    status: "open",
    result,
    createdAt: new Date().toISOString(),
  };

  if (!localOnly) await insertNegotiation(record, n);
  negotiations.push(record);
  return record;
}

/** #25 — 조율 세션(최종 편성 결과) 조회. 없으면 null. */
export async function getNegotiation(id: string): Promise<StoredNegotiation | null> {
  return (await findNegotiation(id)) ?? negotiations.find((n) => n.id === id) ?? null;
}

/** #26 — 조율 취소("다음 공차 일정 대기"). 상태만 cancelled 로. 없으면 null. */
export async function cancelNegotiation(id: string): Promise<StoredNegotiation | null> {
  const updated = await cancelNegotiationRow(id);

  const mirror = negotiations.find((n) => n.id === id);
  if (mirror) mirror.status = "cancelled";

  return updated ?? mirror ?? null;
}

// ── 입력 검증 (순수 함수 — DB 와 무관) ─────────────────────────

export interface ValidationResult {
  ok: boolean;
  /** 필드명 → 사람이 읽을 수 있는 오류 메시지 */
  errors: Record<string, string>;
  /** 검증을 통과했을 때만 채워지는 정규화된 입력 */
  value: ShipmentInput | null;
}

/**
 * 화물 등록 폼(04a)의 원시 요청 본문을 검증하고 `ShipmentInput` 으로 정규화한다.
 * 실패하면 필드별 오류를 모아 돌려주므로 화면에서 각 입력 아래에 바로 표시할 수 있다.
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

  const departureFlexDays = b.departureFlexDays == null ? undefined : Number(b.departureFlexDays);
  if (
    departureFlexDays !== undefined &&
    (!Number.isInteger(departureFlexDays) || departureFlexDays < 0 || departureFlexDays > 7)
  )
    errors.departureFlexDays = "출발일 유연폭은 0~7일 사이 정수여야 합니다.";

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
        departureFlexDays,
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