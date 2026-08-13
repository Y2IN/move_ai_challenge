/**
 * 사업계획서 초안 저장소 — 인메모리.
 *
 * 시연에 DB는 필요 없다. 나중에 붙일 수 있게 접근부만 분리해 둔다.
 *
 * ⚠️ 서버리스에서는 콜드 스타트마다 비워진다. 시연 중 인스턴스가 갈리면
 *    초안이 사라질 수 있으므로, 데모는 한 번에 이어서 진행할 것.
 *    영속이 필요해지면 이 파일의 구현만 교체하면 된다.
 */

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
 * 읽는 Map 이 **서로 다른 객체**가 된다. 방금 만든 초안이 곧바로 404 로 나온다.
 *
 * globalThis 에 한 번만 매달아 번들이 몇 벌이든 같은 저장소를 보게 한다.
 * (콜드 스타트마다 비워지는 건 그대로다 — 영속이 필요하면 이 파일만 교체한다)
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

export function nextApplicationId(): string {
  state.seq += 1;
  return `APP-${String(state.seq).padStart(4, "0")}`;
}

export function save(app: StoredApplication): StoredApplication {
  store.set(app.id, app);
  return app;
}

export function find(id: string): StoredApplication | undefined {
  return store.get(id);
}

/** 사이드바 재진입 시 초안이 있으면 06c로 직행 (api_list #34) */
export function findLatest(): StoredApplication | undefined {
  let latest: StoredApplication | undefined;
  for (const app of store.values()) {
    if (!latest || app.updatedAt > latest.updatedAt) latest = app;
  }
  return latest;
}

/** 문단 하나를 갈아끼우고 이력을 남긴다. */
export function replaceParagraph(
  id: string,
  key: ParagraphKey,
  next: Paragraph,
  action: Revision["action"],
  at: string,
): StoredApplication | undefined {
  const app = store.get(id);
  if (!app) return undefined;

  const before = app.document.paragraphs[key];
  app.document.paragraphs[key] = next;
  app.revisions.push({
    at,
    key,
    action,
    before: before?.text ?? "",
    after: next.text,
    source: next.source,
  });
  app.updatedAt = at;
  return app;
}

/** 테스트·시연 리셋용 */
export function clear(): void {
  store.clear();
  state.seq = 0;
}
