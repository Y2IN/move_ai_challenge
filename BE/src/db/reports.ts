/**
 * 사업계획서 초안의 Supabase 저장소.
 *
 * 저장·조회만 한다. 문단 생성·검증은 report/generate.ts 가 계속 맡는다.
 * 실패 시 항상 `null` — report/store.ts 가 인메모리로 되돌아간다.
 */

import { tryDb, unwrap } from "./client";
import type { Paragraph, ParagraphKey, ReportInput, SubsidyDocument } from "../report/contract";
import type { ParagraphDiagnostic } from "../report/generate";

export interface Revision {
  at: string;
  key: ParagraphKey;
  action: "generate" | "regenerate" | "edit";
  before: string;
  after: string;
  source: Paragraph["source"];
}

export interface ApplicationRecord {
  id: string;
  input: ReportInput;
  document: SubsidyDocument;
  diagnostics: ParagraphDiagnostic[];
  createdAt: string;
  updatedAt: string;
  revisions: Revision[];
}

interface ApplicationRow {
  id: string;
  input: ReportInput;
  document: SubsidyDocument;
  diagnostics: ParagraphDiagnostic[];
  created_at: string;
  updated_at: string;
  subsidy_revisions: RevisionRow[] | null;
}

interface RevisionRow {
  at: string;
  paragraph_key: ParagraphKey;
  action: Revision["action"];
  before_text: string;
  after_text: string;
  source: Paragraph["source"];
}

/**
 * 초안 + 변경 이력을 한 번에 가져온다.
 * PostgREST 의 임베디드 조회 문법 — 라운드트립을 두 번 쓰지 않기 위해서다.
 */
const APP_COLS =
  "id, input, document, diagnostics, created_at, updated_at, " +
  "subsidy_revisions(at, paragraph_key, action, before_text, after_text, source)";

function toRecord(row: ApplicationRow): ApplicationRecord {
  const revisions = (row.subsidy_revisions ?? [])
    .map((r) => ({
      at: r.at,
      key: r.paragraph_key,
      action: r.action,
      before: r.before_text,
      after: r.after_text,
      source: r.source,
    }))
    // 임베디드 조회는 정렬을 보장하지 않는다. 이력은 시간순이어야 화면이 맞는다.
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    id: row.id,
    input: row.input,
    document: row.document,
    diagnostics: row.diagnostics ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revisions,
  };
}

/** 초안 저장 (신규·덮어쓰기 공용). 이력은 appendRevision 이 따로 넣는다. */
export async function upsertApplication(
  app: ApplicationRecord,
  seq: number,
): Promise<ApplicationRecord | null> {
  return tryDb("upsertApplication", async (db) => {
    unwrap(
      await db.from("subsidy_applications").upsert(
        {
          id: app.id,
          seq,
          input: app.input,
          document: app.document,
          diagnostics: app.diagnostics,
          created_at: app.createdAt,
          updated_at: app.updatedAt,
        },
        { onConflict: "id" },
      ),
    );
    return app;
  });
}

/** 문단 교체 후 문서 본문과 updated_at 만 갱신한다 (이력은 appendRevision). */
export async function updateDocument(
  id: string,
  document: SubsidyDocument,
  updatedAt: string,
): Promise<boolean | null> {
  return tryDb("updateDocument", async (db) => {
    const rows = unwrap(
      await db
        .from("subsidy_applications")
        .update({ document, updated_at: updatedAt })
        .eq("id", id)
        .select("id"),
    ) as { id: string }[];
    return rows.length > 0;
  });
}

/** 진단 결과만 갱신한다. updateDocument 는 document·updated_at 만 건드린다. */
export async function updateDiagnostics(
  id: string,
  diagnostics: ParagraphDiagnostic[],
): Promise<void> {
  await tryDb("updateDiagnostics", async (db) => {
    unwrap(
      await db.from("subsidy_applications").update({ diagnostics }).eq("id", id),
    );
    return true;
  });
}

export async function appendRevision(id: string, rev: Revision): Promise<void> {
  await tryDb("appendRevision", async (db) => {
    unwrap(
      await db.from("subsidy_revisions").insert({
        application_id: id,
        at: rev.at,
        paragraph_key: rev.key,
        action: rev.action,
        before_text: rev.before,
        after_text: rev.after,
        source: rev.source,
      }),
    );
    return true;
  });
}

export async function findApplication(id: string): Promise<ApplicationRecord | null> {
  return tryDb("findApplication", async (db) => {
    const rows = unwrap(
      await db.from("subsidy_applications").select(APP_COLS).eq("id", id).limit(1),
    ) as unknown as ApplicationRow[];
    return rows.length ? toRecord(rows[0]) : null;
  });
}

/** 사이드바 재진입 시 초안이 있으면 06c 로 직행 (api_list #34) */
export async function findLatestApplication(): Promise<ApplicationRecord | null> {
  return tryDb("findLatestApplication", async (db) => {
    const rows = unwrap(
      await db
        .from("subsidy_applications")
        .select(APP_COLS)
        .order("updated_at", { ascending: false })
        .limit(1),
    ) as unknown as ApplicationRow[];
    return rows.length ? toRecord(rows[0]) : null;
  });
}

export async function clearApplications(): Promise<void> {
  await tryDb("clearApplications", async (db) => {
    // subsidy_revisions 는 on delete cascade 로 같이 지워진다.
    unwrap(await db.from("subsidy_applications").delete().neq("id", ""));
    return true;
  });
}