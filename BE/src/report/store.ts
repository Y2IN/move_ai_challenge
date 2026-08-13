/**
 * 사업계획서 초안 저장소 — Supabase 우선, 인메모리 폴백.
 *
 * 예전엔 인메모리뿐이라 서버리스 콜드 스타트마다 비워졌다. 초안 생성(POST) →
 * 스트리밍 → 조회(GET)가 서로 다른 람다 인스턴스로 갈리면 방금 만든 초안이
 * 곧바로 404 로 나왔다. 심사위원이 2주간 테스트하는 환경에서는 치명적이라
 * DB 를 붙였다.
 *
 * 쓰기는 DB·메모리 양쪽에, 읽기는 DB 우선. DB 가 없거나 잠들면 예전과 같이 동작한다.
 */

import {
  appendRevision,
  clearApplications,
  findApplication,
  findLatestApplication,
  updateDiagnostics,
  updateDocument,
  upsertApplication,
} from "../db/reports";
import { isDbEnabled, nextSeq } from "../db/client";
import type {
  Paragraph,
  ParagraphKey,
  ReportInput,
  SubsidyDocument,
} from "./contract";
import type { ParagraphDiagnostic } from "./generate";

export interface StoredApplication {
  id: string;
  /**
   * 이 초안을 만든 **바로 그 입력**. 재생성·편집 검증에 반드시 이걸 쓴다.
   *
   * 다시 `resolveReportInput()` 을 부르면 그 사이 편성이 바뀌어 다른 수치가 나오고,
   * 문단은 새 숫자를 인용하는데 문서의 표는 옛 숫자를 그대로 들고 있게 된다.
   * 게다가 환각 허용집합도 엉뚱한 입력으로 만들어져 불일치가 검증을 통과해 버린다.
   */
  input: ReportInput;
  document: SubsidyDocument;
  diagnostics: ParagraphDiagnostic[];
  createdAt: string;
  updatedAt: string;
  /** 문단 변경 이력 (api_list #38) */
  revisions: Revision[];
}

export interface Revision {
  at: string;
  key: ParagraphKey;
  action: "generate" | "regenerate" | "edit";
  before: string;
  after: string;
  source: Paragraph["source"];
}

/**
 * ⚠️ 모듈 최상위에 `new Map()` 을 두면 안 된다.
 *
 * Next 는 라우트 핸들러마다 서버 번들을 따로 만든다. 그러면 이 모듈도 번들마다
 * 한 벌씩 생겨서 `POST /applications` 가 저장한 Map 과 `GET /applications/{id}` 가
 * 읽는 Map 이 **서로 다른 객체**가 된다.
 *
 * globalThis 에 한 번만 매달아 번들이 몇 벌이든 같은 저장소를 보게 한다.
 * (DB 가 붙으면 이 Map 은 폴백용 미러다)
 */
interface ReportStoreState {
  apps: Map<string, StoredApplication>;
  seq: number;
}

const globalRef = globalThis as typeof globalThis & {
  __railhubReportStore?: ReportStoreState;
};

const state: ReportStoreState = (globalRef.__railhubReportStore ??= {
  apps: new Map(),
  seq: 0,
});

const store = state.apps;

/**
 * 발급한 id 별로 번호와 "DB 에 써도 되는지" 를 기억해 둔다.
 *
 * 모듈 변수 하나(`lastSeq`)로 들고 있으면 동시 요청 두 건이 서로의 번호를 덮어쓴다.
 * id 로 키를 잡으면 발급과 저장이 짝을 잃지 않는다.
 */
const issued = new Map<string, { seq: number; localOnly: boolean }>();

/**
 * APP-NNNN 발급. id 문자열 규칙은 여기 한 곳에만 둔다 (SQL 은 번호만 준다).
 *
 * ⚠️ store.ts 의 `issueSeq` 와 같은 이유로 **"DB 꺼짐" 과 "시퀀스만 실패" 를 구분한다.**
 *    후자에서 인메모리 카운터가 낸 번호는 DB 에 이미 있는 APP-0001 과 겹치고,
 *    upsert 는 `onConflict: "id"` 라 **남의 초안을 통째로 덮어쓴다.**
 */
export async function nextApplicationId(): Promise<string> {
  const fromDb = await nextSeq("application");
  const seq = fromDb ?? (state.seq += 1);
  if (fromDb !== null && fromDb > state.seq) state.seq = fromDb;

  const id = `APP-${String(seq).padStart(4, "0")}`;
  issued.set(id, { seq, localOnly: fromDb === null && isDbEnabled() });
  return id;
}

export async function save(app: StoredApplication): Promise<StoredApplication> {
  const meta = issued.get(app.id);
  issued.delete(app.id); // 한 번 쓰면 버린다 (재저장은 updateDocument 가 맡는다)

  // localOnly 면 DB 에 쓰지 않는다 — 남의 초안을 덮어쓸 수 있다.
  if (!meta?.localOnly) await upsertApplication(app, meta?.seq ?? state.seq ?? 1);
  store.set(app.id, app);
  return app;
}

export async function find(id: string): Promise<StoredApplication | undefined> {
  return (await findApplication(id)) ?? store.get(id);
}

/** 사이드바 재진입 시 초안이 있으면 06c로 직행 (api_list #34) */
export async function findLatest(): Promise<StoredApplication | undefined> {
  const fromDb = await findLatestApplication();
  if (fromDb) return fromDb;

  let latest: StoredApplication | undefined;
  for (const app of store.values()) {
    if (!latest || app.updatedAt > latest.updatedAt) latest = app;
  }
  return latest;
}

/** 문단 하나를 갈아끼우고 이력을 남긴다. */
export async function replaceParagraph(
  id: string,
  key: ParagraphKey,
  next: Paragraph,
  action: Revision["action"],
  at: string,
): Promise<StoredApplication | undefined> {
  const app = await find(id);
  if (!app) return undefined;

  const before = app.document.paragraphs[key];
  app.document.paragraphs[key] = next;
  const revision: Revision = {
    at,
    key,
    action,
    before: before?.text ?? "",
    after: next.text,
    source: next.source,
  };
  app.revisions.push(revision);
  app.updatedAt = at;

  await updateDocument(id, app.document, at);
  await appendRevision(id, revision);

  // 미러도 최신으로 (DB 가 나중에 끊겨도 이 인스턴스는 최신 문서를 들고 있게)
  store.set(id, app);
  return app;
}

/**
 * 진단 결과(어느 문단이 왜 폴백으로 떨어졌는지)를 저장한다.
 *
 * `app.diagnostics = ...` 로 객체에 직접 대입하면 안 된다. DB 모드에서 `find()` 는
 * 매 호출마다 행을 새로 매핑한 **별개 객체**를 돌려주므로, 그 대입은 곧 버려지는
 * 사본에만 남고 DB 에도 미러에도 반영되지 않는다.
 */
export async function saveDiagnostics(
  id: string,
  diagnostics: ParagraphDiagnostic[],
): Promise<void> {
  await updateDiagnostics(id, diagnostics);
  const mirror = store.get(id);
  if (mirror) mirror.diagnostics = diagnostics;
}

/** 테스트·시연 리셋용 */
export async function clear(): Promise<void> {
  await clearApplications();
  store.clear();
  issued.clear();
  state.seq = 0;
}