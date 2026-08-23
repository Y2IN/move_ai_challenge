/**
 * 화물·편성·조율의 Supabase 저장소.
 *
 * 이 모듈은 **저장/조회만** 한다. 검증·정규화·매칭 같은 도메인 로직은
 * store.ts 에 그대로 남는다. 그래야 인메모리 경로와 DB 경로가 같은 규칙을 쓴다.
 *
 * 모든 함수는 실패 시 `null` 을 돌려준다 (throw 하지 않는다 — client.ts 의 계약).
 * store.ts 가 null 을 받으면 인메모리로 되돌아간다.
 */

import { tryDb, unwrap } from "./client";
import type { CalcResult, EmptyWagon, Shipment, ShipmentInput } from "../types";
import type { MatchCandidate } from "../matching";
import type { NegotiationResult } from "../negotiate";

// ── 화물 ───────────────────────────────────────────────────────

/** store.ts 의 StoredShipment 와 같은 모양 (원본 입력 + 정규화 결과 + seq) */
export interface ShipmentRecord {
  input: ShipmentInput;
  shipment: Shipment;
  seq: number;
}

interface ShipmentRow {
  id: string;
  seq: number;
  input: ShipmentInput;
  shipment: Shipment;
}

const SHIPMENT_COLS = "id, seq, input, shipment";

function toRecord(row: ShipmentRow): ShipmentRecord {
  return { input: row.input, shipment: row.shipment, seq: Number(row.seq) };
}

/**
 * 목록·필터용 컬럼을 Shipment 에서 꺼낸다.
 *
 * jsonb 안에도 같은 값이 들어 있지만, Table Editor 에서 바로 읽히고
 * 인덱스를 걸 수 있어야 해서 밖으로 한 번 더 펴 둔다.
 */
function columnsOf(shipment: Shipment) {
  return {
    shipper_id: shipment.shipperId,
    shipper_name: shipment.shipperName ?? null,
    category: shipment.cargo.category,
    weight_ton: shipment.cargo.weightTon,
    origin_station_id: shipment.origin.stationId,
    dest_station_id: shipment.destination.stationId,
    departure_date: shipment.schedule.requestedDepartureDate,
  };
}

export async function insertShipment(
  rec: ShipmentRecord,
): Promise<ShipmentRecord | null> {
  return tryDb("insertShipment", async (db) => {
    unwrap(
      await db.from("registered_shipments").insert({
        id: rec.shipment.id,
        seq: rec.seq,
        input: rec.input,
        shipment: rec.shipment,
        ...columnsOf(rec.shipment),
      }),
    );
    return rec;
  });
}

/** 최근 등록이 앞으로 오도록 정렬해서 전부 돌려준다. */
export async function listShipmentRecords(): Promise<ShipmentRecord[] | null> {
  return tryDb("listShipments", async (db) => {
    const rows = unwrap(
      await db
        .from("registered_shipments")
        .select(SHIPMENT_COLS)
        .order("seq", { ascending: false }),
    ) as ShipmentRow[];
    return rows.map(toRecord);
  });
}

export async function findShipmentRecord(
  id: string,
): Promise<ShipmentRecord | null> {
  return tryDb("findShipment", async (db) => {
    const rows = unwrap(
      await db
        .from("registered_shipments")
        .select(SHIPMENT_COLS)
        .eq("id", id)
        .limit(1),
    ) as ShipmentRow[];
    return rows.length ? toRecord(rows[0]) : null;
  });
}

/**
 * 수정. 저장된 행이 없으면 `"notFound"`, DB 자체가 불가하면 `null`.
 *
 * 두 경우를 구분해야 store.ts 가 404 를 낼지 인메모리로 갈지 결정할 수 있다.
 */
export async function updateShipmentRecord(
  rec: ShipmentRecord,
): Promise<ShipmentRecord | "notFound" | null> {
  return tryDb("updateShipment", async (db) => {
    const rows = unwrap(
      await db
        .from("registered_shipments")
        .update({
          input: rec.input,
          shipment: rec.shipment,
          ...columnsOf(rec.shipment),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.shipment.id)
        .select("id"),
    ) as { id: string }[];
    return rows.length ? rec : ("notFound" as const);
  });
}

/**
 * 여러 화물의 상태를 한 번에 바꾼다 (확정된 편성에 실린 화물 → "confirmed").
 *
 * 이게 없으면 이미 실려 나간 화물이 다음 매칭·공차 적재율에 계속 다시 잡힌다.
 * jsonb 안의 status 도 같이 바꿔야 한다 — 매칭이 읽는 건 payload 쪽이다.
 */
export async function markShipmentsStatus(
  ids: string[],
  status: Shipment["status"],
): Promise<number | null> {
  if (!ids.length) return 0;
  return tryDb("markShipmentsStatus", async (db) => {
    const rows = unwrap(
      await db.from("registered_shipments").select(SHIPMENT_COLS).in("id", ids),
    ) as ShipmentRow[];

    let n = 0;
    for (const row of rows) {
      if (row.shipment.status === status) continue;
      const next = { ...row.shipment, status };
      unwrap(
        await db
          .from("registered_shipments")
          .update({ shipment: next, updated_at: new Date().toISOString() })
          .eq("id", row.id),
      );
      n += 1;
    }
    return n;
  });
}

export async function deleteShipmentRecord(
  id: string,
): Promise<boolean | null> {
  return tryDb("deleteShipment", async (db) => {
    const rows = unwrap(
      await db.from("registered_shipments").delete().eq("id", id).select("id"),
    ) as { id: string }[];
    return rows.length > 0;
  });
}

// ── 편성 확정 ──────────────────────────────────────────────────

/** 편성 상태 — 확정(화주 측) → 승인(코레일 배차 담당자) */
export type ConfirmationStatus = "confirmed" | "approved";

export interface ConfirmationRecord {
  groupId: string;
  status: ConfirmationStatus;
  /** 코레일이 배정을 승인한 시각. 미승인이면 null */
  approvedAt?: string | null;
  /** 승인한 담당자 표기 */
  approvedBy?: string | null;
  /** 멱등 키 — 같은 키의 확정 요청은 기존 편성을 재사용한다 */
  clientKey?: string | null;
  wagon: EmptyWagon;
  members: MatchCandidate[];
  totalTon: number;
  capacityTon: number;
  loadFactor: number;
  confirmedAt: string;
  calc: CalcResult | null;
}

export async function insertConfirmation(
  c: ConfirmationRecord,
  seq: number,
): Promise<ConfirmationRecord | null> {
  return tryDb("insertConfirmation", async (db) => {
    const row: Record<string, unknown> = {
      group_id: c.groupId,
      seq,
      status: c.status,
      wagon_id: c.wagon.id,
      total_ton: c.totalTon,
      capacity_ton: c.capacityTon,
      load_factor: c.loadFactor,
      confirmed_at: c.confirmedAt,
      wagon: c.wagon,
      members: c.members,
      calc: c.calc,
    };
    if (c.clientKey) row.client_key = c.clientKey;

    const res = await db.from("confirmations").insert(row);
    // client_key 는 나중에 추가된 컬럼이다. 없는 프로젝트에서는 빼고 다시 넣는다
    // (멱등은 못 하지만 확정 자체는 되어야 한다).
    if (res.error && /client_key/i.test(res.error.message)) {
      delete row.client_key;
      unwrap(await db.from("confirmations").insert(row));
      return c;
    }
    unwrap(res);
    return c;
  });
}

interface ConfirmationRow {
  group_id: string;
  status: ConfirmationStatus;
  approved_at?: string | null;
  approved_by?: string | null;
  wagon: EmptyWagon;
  members: MatchCandidate[];
  total_ton: number;
  capacity_ton: number;
  load_factor: number;
  confirmed_at: string;
  calc: CalcResult | null;
}

/**
 * `*` 를 쓰는 이유: 승인 컬럼(approved_at·approved_by)은 나중에 추가된 것이라
 * 열 이름을 명시하면 아직 마이그레이션을 안 돌린 프로젝트에서 SELECT 가 통째로
 * 실패한다. `*` 면 있으면 오고 없으면 안 온다 — 두 상태를 한 쿼리로 감당한다.
 * (실제로 컬럼을 추가한 뒤에도 이 목록이 낡아 승인 시각이 계속 null 로 보였다)
 */
const CONFIRMATION_COLS = "*";

/**
 * 코레일 배차 승인 (api_list #43).
 *
 * `status` 는 기존 컬럼이라 스키마 변경 없이 동작한다. 승인 시각·담당자 컬럼은
 * 나중에 추가된 것이라 없으면 상태만 바꾼다 (승인 자체는 되어야 한다).
 */
export async function approveConfirmationRow(
  groupId: string,
  approvedBy: string,
): Promise<ConfirmationRecord | "notFound" | null> {
  return tryDb("approveConfirmation", async (db) => {
    const at = new Date().toISOString();

    const full = await db
      .from("confirmations")
      .update({ status: "approved", approved_at: at, approved_by: approvedBy })
      .eq("group_id", groupId)
      .select(CONFIRMATION_COLS);

    if (!full.error) {
      const rows = full.data as ConfirmationRow[];
      return rows.length ? toConfirmation(rows[0]) : ("notFound" as const);
    }
    if (!/approved_at|approved_by/i.test(full.error.message)) {
      throw new Error(full.error.message);
    }

    const rows = unwrap(
      await db
        .from("confirmations")
        .update({ status: "approved" })
        .eq("group_id", groupId)
        .select(CONFIRMATION_COLS),
    ) as ConfirmationRow[];
    if (!rows.length) return "notFound" as const;
    return { ...toConfirmation(rows[0]), approvedAt: at, approvedBy };
  });
}

function toConfirmation(r: ConfirmationRow): ConfirmationRecord {
  return {
    groupId: r.group_id,
    status: r.status,
    approvedAt: r.approved_at ?? null,
    approvedBy: r.approved_by ?? null,
    wagon: r.wagon,
    members: r.members,
    totalTon: r.total_ton,
    capacityTon: r.capacity_ton,
    loadFactor: r.load_factor,
    confirmedAt: r.confirmed_at,
    calc: r.calc,
  };
}

/** 가장 최근 확정 편성. 없으면 null. 사업계획서가 실적을 집계할 때 쓴다. */
export async function findLatestConfirmation(): Promise<ConfirmationRecord | null> {
  return tryDb("findLatestConfirmation", async (db) => {
    const rows = unwrap(
      await db
        .from("confirmations")
        .select(CONFIRMATION_COLS)
        .order("confirmed_at", { ascending: false })
        .limit(1),
    ) as ConfirmationRow[];
    return rows.length ? toConfirmation(rows[0]) : null;
  });
}

/** 편성 번호(GRP-NNN)로 한 건. 확정 화면이 새로고침돼도 같은 편성을 다시 그린다. */
export async function findConfirmation(groupId: string): Promise<ConfirmationRecord | null> {
  return tryDb("findConfirmation", async (db) => {
    const rows = unwrap(
      await db.from("confirmations").select(CONFIRMATION_COLS).eq("group_id", groupId).limit(1),
    ) as ConfirmationRow[];
    return rows.length ? toConfirmation(rows[0]) : null;
  });
}

/**
 * 멱등 키로 기존 확정을 찾는다. 컬럼이 없는 프로젝트에서는 null (멱등 없이 동작).
 */
export async function findConfirmationByClientKey(
  clientKey: string,
): Promise<ConfirmationRecord | null> {
  return tryDb("findConfirmationByClientKey", async (db) => {
    const res = await db
      .from("confirmations")
      .select(CONFIRMATION_COLS)
      .eq("client_key", clientKey)
      .limit(1);
    if (res.error) {
      if (/client_key/i.test(res.error.message)) return null;
      throw new Error(res.error.message);
    }
    const rows = res.data as ConfirmationRow[];
    return rows.length ? toConfirmation(rows[0]) : null;
  });
}

// ── 조율 세션 ──────────────────────────────────────────────────

export interface NegotiationRecord {
  id: string;
  status: "open" | "cancelled";
  result: NegotiationResult;
  createdAt: string;
}

interface NegotiationRow {
  id: string;
  status: "open" | "cancelled";
  result: NegotiationResult;
  created_at: string;
}

function toNegotiation(row: NegotiationRow): NegotiationRecord {
  return {
    id: row.id,
    status: row.status,
    result: row.result,
    createdAt: row.created_at,
  };
}

export async function insertNegotiation(
  rec: NegotiationRecord,
  seq: number,
): Promise<NegotiationRecord | null> {
  return tryDb("insertNegotiation", async (db) => {
    unwrap(
      await db.from("negotiations").insert({
        id: rec.id,
        seq,
        status: rec.status,
        result: rec.result,
        created_at: rec.createdAt,
      }),
    );
    return rec;
  });
}

export async function findNegotiation(
  id: string,
): Promise<NegotiationRecord | null> {
  return tryDb("findNegotiation", async (db) => {
    const rows = unwrap(
      await db
        .from("negotiations")
        .select("id, status, result, created_at")
        .eq("id", id)
        .limit(1),
    ) as NegotiationRow[];
    return rows.length ? toNegotiation(rows[0]) : null;
  });
}

/** 취소는 상태만 바꾼다 ("다음 공차 일정 대기"). 행이 없으면 null. */
export async function cancelNegotiationRow(
  id: string,
): Promise<NegotiationRecord | null> {
  return tryDb("cancelNegotiation", async (db) => {
    const rows = unwrap(
      await db
        .from("negotiations")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select("id, status, result, created_at"),
    ) as NegotiationRow[];
    return rows.length ? toNegotiation(rows[0]) : null;
  });
}

// ── 리셋 (테스트·시연용) ───────────────────────────────────────

export async function clearAll(): Promise<void> {
  await tryDb("clearAll", async (db) => {
    // neq('id','') 는 "전체 행" 을 뜻한다 — supabase-js 는 필터 없는 delete 를 막는다.
    unwrap(await db.from("registered_shipments").delete().neq("id", ""));
    unwrap(await db.from("confirmations").delete().neq("group_id", ""));
    unwrap(await db.from("negotiations").delete().neq("id", ""));
    return true;
  });
}
