/**
 * K-ESG 리포트 문단의 **사람 편집분** 저장소.
 *
 * ## 왜 문단 전체가 아니라 편집분만 저장하나
 *
 * ESG 리포트는 실적 집계에서 매번 다시 생성된다 — 원장이 바뀌면 문장의 숫자도
 * 따라 바뀌어야 하기 때문이다. 그래서 생성 결과를 통째로 저장하면 원장과 어긋난
 * 옛 문장이 굳어버린다. 대신 **사람이 고친 문단만** 기록해 두고, 생성할 때마다
 * 그 위에 덮어씌운다 (사업계획서 #35 가 사용자 편집을 보존하는 것과 같은 규칙).
 *
 * 키는 (기간, 화주, 문단) 이다. 다른 분기를 보면 그 분기의 편집만 적용된다.
 *
 * 테이블이 없으면 인메모리 미러로 돈다 (settlement-docs.ts 와 같은 계약).
 */

import { tryDb, unwrap } from "./client";
import type { EsgSectionKey } from "../esg/types";

export interface EsgEdit {
  periodId: string;
  shipperId: string | null;
  key: EsgSectionKey;
  text: string;
  editedAt: string;
}

interface EditRow {
  period_id: string;
  shipper_id: string | null;
  section_key: EsgSectionKey;
  text: string;
  edited_at: string;
}

const globalRef = globalThis as typeof globalThis & {
  __railhubEsgEdits?: Map<string, EsgEdit>;
};

const mirror = (globalRef.__railhubEsgEdits ??= new Map());

/** 같은 (기간·화주·문단) 은 한 벌만 남는다 */
const cacheKey = (periodId: string, shipperId: string | null, key: string) =>
  `${periodId}|${shipperId ?? "*"}|${key}`;

const toEdit = (r: EditRow): EsgEdit => ({
  periodId: r.period_id,
  shipperId: r.shipper_id,
  key: r.section_key,
  text: r.text,
  editedAt: r.edited_at,
});

/** 이 기간·화주에 저장된 편집분. 문단 키로 찾을 수 있게 Map 으로 준다. */
export async function listEdits(
  periodId: string,
  shipperId: string | null,
): Promise<Map<EsgSectionKey, EsgEdit>> {
  const rows = await tryDb("listEsgEdits", async (db) => {
    let q = db.from("esg_section_edits").select("*").eq("period_id", periodId);
    q = shipperId ? q.eq("shipper_id", shipperId) : q.is("shipper_id", null);
    const res = await q;
    if (res.error) {
      if (/does not exist|schema cache/i.test(res.error.message)) return null;
      throw new Error(res.error.message);
    }
    return res.data as EditRow[];
  });

  const out = new Map<EsgSectionKey, EsgEdit>();
  // 미러를 먼저 깔고 DB 값으로 덮는다 (DB 가 최신)
  for (const e of mirror.values()) {
    if (e.periodId === periodId && (e.shipperId ?? null) === shipperId) out.set(e.key, e);
  }
  for (const r of rows ?? []) out.set(r.section_key, toEdit(r));
  return out;
}

/** 편집 저장. DB 에 못 써도 미러에는 남겨 이 인스턴스에서는 즉시 반영된다. */
export async function saveEdit(edit: EsgEdit): Promise<{ persisted: boolean }> {
  mirror.set(cacheKey(edit.periodId, edit.shipperId, edit.key), edit);

  const saved = await tryDb("saveEsgEdit", async (db) => {
    const res = await db
      .from("esg_section_edits")
      .upsert(
        {
          period_id: edit.periodId,
          shipper_id: edit.shipperId,
          section_key: edit.key,
          text: edit.text,
          edited_at: edit.editedAt,
        },
        { onConflict: "period_id,shipper_id,section_key" },
      )
      .select("section_key");
    if (res.error) {
      if (/does not exist|schema cache/i.test(res.error.message)) return null;
      throw new Error(res.error.message);
    }
    return unwrap(res);
  });

  return { persisted: saved !== null };
}

/** 편집 되돌리기 — 다음 생성부터 AI 문장이 다시 나온다. */
export async function clearEdit(
  periodId: string,
  shipperId: string | null,
  key: EsgSectionKey,
): Promise<void> {
  mirror.delete(cacheKey(periodId, shipperId, key));
  await tryDb("clearEsgEdit", async (db) => {
    let q = db
      .from("esg_section_edits")
      .delete()
      .eq("period_id", periodId)
      .eq("section_key", key);
    q = shipperId ? q.eq("shipper_id", shipperId) : q.is("shipper_id", null);
    const res = await q;
    if (res.error && !/does not exist|schema cache/i.test(res.error.message)) {
      throw new Error(res.error.message);
    }
    return true;
  });
}
