/**
 * 전환교통 보조금 사업계획서 API(#31~#39) 클라이언트.
 *
 * 화면은 이 파일만 알면 됩니다 — 엔드포인트 경로·에러 모양이 바뀌면 여기 한 곳만
 * 고칩니다. 타입은 BE 소스(@railhub/be)에서 **type-only** 로 가져와 클라이언트
 * 번들에 BE 코드가 딸려 오지 않습니다. (`src/lib/esg.ts` 와 같은 규칙입니다)
 *
 * ⚠️ 문단 재생성 경로는 api_list #36 의 표기(`.../paragraphs/{key}/regenerate`)와
 *    다릅니다. 실제 라우트는 `.../paragraphs/{key}` 에 POST(재생성) / PATCH(편집
 *    저장)로 구현돼 있습니다. 표가 아니라 라우트를 따릅니다.
 */

import type {
  Paragraph,
  ParagraphKey,
  SubsidyDocument,
} from '@railhub/be/report/contract';
import type { ParagraphDiagnostic } from '@railhub/be/report/generate';
import type { Revision } from '@railhub/be/report/store';

export type { Paragraph, ParagraphDiagnostic, ParagraphKey, Revision, SubsidyDocument };

/** 문단이 문서에 놓이는 순서. BE PARAGRAPH_KEYS 와 같은 순서입니다. */
export const PARAGRAPH_ORDER: ParagraphKey[] = [
  'overview',
  'plan',
  'extraCost',
  'benefit',
  'result',
  'closing',
];

/** 서식 하단 고정 문구. BE 가 문단에 개입하지 않는 범위를 선언합니다. */
export const SUBSIDY_DISCLAIMER =
  '수치는 법정 산식으로 계산되며, AI는 서술 문장만 작성합니다.';

// ── 에러 ───────────────────────────────────────────────────────

export class SubsidyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function throwFrom(res: Response): Promise<never> {
  let message = `요청이 실패했습니다 (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // JSON 이 아니면 상태 코드 문구를 그대로 씁니다.
  }
  throw new SubsidyApiError(message, res.status);
}

const BASE = '/api/subsidy/applications';

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: 'no-store', ...init });
  if (!res.ok) await throwFrom(res);
  return (await res.json()) as T;
}

// ── #31 생성 ───────────────────────────────────────────────────

/**
 * 수치가 실계산인지 고정값인지. `fixture` 면 화면에 그 사실을 표시해야 합니다 —
 * 계산이 죽어도 시연이 되도록 BE 가 조용히 떨어뜨리는 경로가 있습니다.
 */
export type InputOrigin = 'live' | 'fixture';

export interface ApplicationPayload {
  applicationId: string;
  document: SubsidyDocument;
  diagnostics?: ParagraphDiagnostic[];
  inputOrigin?: InputOrigin;
  inputNote?: string | null;
  revisionCount?: number;
  /** `draft` = 저장된 초안 없이 수치만 채운 빈 서식 (문단이 비어 있습니다) */
  stage?: 'generated' | 'draft';
}

/**
 * POST /api/subsidy/applications — 문단 6개를 병렬 생성합니다(LLM, 약 10초).
 * 인증이 없거나 호출이 실패해도 200 이고 문단에 `fallback` 배지가 붙습니다.
 */
export function createApplication(
  body: { trips?: number; now?: string } = {},
): Promise<ApplicationPayload> {
  return json<ApplicationPayload>(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── #33 조회 ───────────────────────────────────────────────────

/** GET /api/subsidy/applications/{id} — LLM 미사용이라 빠릅니다. */
export function fetchApplication(id: string): Promise<ApplicationPayload> {
  return json<ApplicationPayload>(`${BASE}/${encodeURIComponent(id)}`);
}

// ── #34 최근 초안 ──────────────────────────────────────────────

export interface LatestApplication {
  exists: boolean;
  applicationId: string | null;
  createdAt?: string;
  updatedAt?: string;
  paragraphCount?: number;
  revisionCount?: number;
  eligible?: boolean;
}

/**
 * GET /api/subsidy/applications/latest — 초안이 이미 있으면 재생성 없이 재사용합니다.
 * 06c 재진입마다 LLM 을 6번 부르지 않기 위한 것입니다.
 */
export function fetchLatestApplication(): Promise<LatestApplication> {
  return json<LatestApplication>(`${BASE}/latest`);
}

// ── #35 전체 재생성 ────────────────────────────────────────────

export interface RegenerateAllPayload {
  applicationId: string;
  document: SubsidyDocument;
  diagnostics: ParagraphDiagnostic[];
  /** 사용자가 직접 고쳐서 보존된 문단 — 덮어쓰지 않았다고 알려야 합니다 */
  keptUserEdits: ParagraphKey[];
  revisionCount: number;
}

/** `force` 를 켜면 사용자가 편집한 문단까지 덮어씁니다. 기본은 보존입니다. */
export function regenerateAll(id: string, force = false): Promise<RegenerateAllPayload> {
  const q = force ? '?force=true' : '';
  return json<RegenerateAllPayload>(`${BASE}/${encodeURIComponent(id)}/regenerate${q}`, {
    method: 'POST',
  });
}

// ── #36 문단 재생성 · #37 문단 편집 저장 ───────────────────────

export interface ParagraphPayload {
  applicationId: string;
  paragraph: Paragraph;
  diagnostic?: ParagraphDiagnostic;
  /** 편집 저장 시 숫자 검증 경고. 저장은 막지 않고 경고만 옵니다. */
  warning?: string | null;
  revisionCount: number;
}

function paragraphUrl(id: string, key: ParagraphKey): string {
  return `${BASE}/${encodeURIComponent(id)}/paragraphs/${encodeURIComponent(key)}`;
}

/** #36 문단 하나만 다시 생성(↻). 초안을 만든 그 입력을 서버가 재사용합니다. */
export function regenerateParagraph(
  id: string,
  key: ParagraphKey,
): Promise<ParagraphPayload> {
  return json<ParagraphPayload>(paragraphUrl(id, key), { method: 'POST' });
}

/** #37 편집 저장. 저장된 문단은 출처가 `user` 로 내려갑니다. */
export function saveParagraph(
  id: string,
  key: ParagraphKey,
  text: string,
): Promise<ParagraphPayload> {
  return json<ParagraphPayload>(paragraphUrl(id, key), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

// ── #38 변경 이력 ──────────────────────────────────────────────

export function fetchRevisions(id: string): Promise<{ applicationId: string; revisions: Revision[] }> {
  return json(`${BASE}/${encodeURIComponent(id)}/revisions`);
}

// ── #39 내보내기 ───────────────────────────────────────────────

/** hwp 는 501 입니다 — 버튼을 비활성 + "준비 중" 으로 두세요. */
export type SubsidyExportFormat = 'html' | 'pdf';

export function applicationExportUrl(id: string, format: SubsidyExportFormat): string {
  return `${BASE}/${encodeURIComponent(id)}/export?format=${format}`;
}
