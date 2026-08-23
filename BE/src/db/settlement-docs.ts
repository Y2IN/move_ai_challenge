/**
 * 정산 제출 서류의 제출 상태 저장소.
 *
 * **파일 본문은 보관하지 않습니다.** 무엇이 언제 올라왔는지(이름·시각)만 남깁니다 —
 * 시연 범위에서 파일 스토리지를 붙이면 용량·권한·수명주기까지 따라오는데,
 * 화면이 필요한 건 "필수 서류가 다 찼는가" 하나입니다.
 *
 * client.ts 계약대로 실패는 전부 null 로 흡수하고, 그때는 인메모리 미러로 돕니다
 * (테이블이 아직 없는 프로젝트에서도 화면이 죽지 않습니다).
 */

import { tryDb, unwrap } from "./client";
import type { SettlementDocument } from "../types";

export interface DocUpload {
  key: string;
  name: string;
  uploadedAt: string;
}

interface DocRow {
  key: string;
  file: { name: string; uploadedAt: string } | null;
}

const globalRef = globalThis as typeof globalThis & {
  __railhubSettlementDocs?: Map<string, { name: string; uploadedAt: string }>;
};

const mirror = (globalRef.__railhubSettlementDocs ??= new Map());

/** 제출된 서류 상태. DB 가 없으면 이 인스턴스 메모리 기준. */
export async function listUploads(): Promise<Map<string, { name: string; uploadedAt: string }>> {
  const rows = await tryDb("listSettlementDocs", async (db) => {
    const res = await db.from("settlement_documents").select("key, file");
    if (res.error) {
      // 테이블이 아직 없는 프로젝트 — 미러로만 돈다
      if (/does not exist|schema cache/i.test(res.error.message)) return null;
      throw new Error(res.error.message);
    }
    return res.data as DocRow[];
  });

  if (!rows) return mirror;

  const out = new Map(mirror);
  for (const r of rows) if (r.file) out.set(r.key, r.file);
  return out;
}

/** 업로드 기록. DB 에 못 써도 미러에는 남겨 화면이 즉시 반영되게 한다. */
export async function saveUpload(key: string, fileName: string): Promise<DocUpload> {
  const file = { name: fileName, uploadedAt: new Date().toISOString() };
  mirror.set(key, file);

  await tryDb("saveSettlementDoc", async (db) => {
    const res = await db
      .from("settlement_documents")
      .update({ file, updated_at: file.uploadedAt })
      .eq("key", key)
      .select("key");
    if (res.error) {
      if (/does not exist|schema cache/i.test(res.error.message)) return null;
      throw new Error(res.error.message);
    }
    return unwrap(res);
  });

  return { key, ...file };
}

/** 시드 서류 목록에 제출 상태를 덧입힌다. */
export function mergeUploads(
  docs: SettlementDocument[],
  uploads: Map<string, { name: string; uploadedAt: string }>,
): SettlementDocument[] {
  return docs.map((d) => {
    const up = uploads.get(d.key);
    return up ? { ...d, file: up } : d;
  });
}
