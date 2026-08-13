/**
 * Supabase 클라이언트 — 서버 전용.
 *
 * ── 이 파일의 계약 ────────────────────────────────────────────────
 *
 * **환경변수가 없으면 null 을 돌려준다. 절대 throw 하지 않는다.**
 *
 * 호출부(store.ts, report/store.ts)는 null 이면 인메모리로 되돌아간다.
 * 그래서 DB 가 없어도 · 잠들어도 · 키가 틀려도 앱은 지금까지처럼 뜬다.
 * `GEMINI_API_KEY` 가 없을 때 서술 초안으로 대체하는 것과 같은 패턴이다.
 *
 * Supabase 무료 플랜은 **7일간 요청이 0건이면** 프로젝트를 재운다.
 * 심사 기간에 잠기면 이 폴백이 그대로 받아낸다 (등록 화물이 안 쌓일 뿐,
 * 화면은 전부 동작한다). 재우지 않으려면 keepalive 워크플로를 함께 둔다
 * — .github/workflows/keepalive.yml
 *
 * ── 왜 service_role 키인가 ───────────────────────────────────────
 *
 * 이 앱은 브라우저에서 DB 를 직접 부르지 않는다. 전부 `FE/app/api/*`
 * Route Handler 를 거친다. 그래서 RLS 정책을 한 줄도 쓰지 않고
 * (schema.sql 에서 전 테이블 RLS on + anon 권한 revoke) 서버만 통과시킨다.
 *
 * ⚠️ service_role 키는 RLS 를 우회한다. **절대 NEXT_PUBLIC_ 접두어를 붙이지 말 것.**
 *    붙는 순간 브라우저 번들에 박혀서 DB 전체가 공개된다.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** 한 번 판정한 결과를 재사용한다 (요청마다 클라이언트를 새로 만들 이유가 없다). */
let cached: SupabaseClient | null | undefined;

/** 왜 꺼져 있는지 — /api/health 가 이 문구를 그대로 노출한다. */
let reason = "";

function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Supabase 클라이언트. 환경변수가 없거나 형식이 틀리면 `null`.
 *
 * 반환이 null 이면 **호출부가 인메모리로 처리해야 한다.** 예외를 던지지 않는 건
 * 시연 중 DB 문제로 화면이 500 을 뱉는 상황을 막기 위해서다.
 */
export function getDb(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = read("SUPABASE_URL");
  const key = read("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    reason = "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 — 인메모리로 동작합니다";
    return (cached = null);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    reason = `SUPABASE_URL 형식이 올바르지 않습니다: ${url}`;
    return (cached = null);
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // 서버에서만 쓰므로 세션·실시간 기능이 필요 없다.
    global: { headers: { "x-application-name": "railhub-x" } },
  });
  reason = "";
  return cached;
}

/** DB 를 쓸 수 있는 상태인가. 라우트가 분기할 때 쓴다. */
export function isDbEnabled(): boolean {
  return getDb() !== null;
}

/** 꺼져 있는 이유 (켜져 있으면 빈 문자열). /api/health 표시용. */
export function dbDisabledReason(): string {
  getDb();
  return reason;
}

/**
 * 쿼리 한 번을 감싸서 **실패를 절대 위로 던지지 않게** 한다.
 *
 * DB 가 잠들었거나(무료 플랜 7일 정지) 네트워크가 끊겨도 호출부는 `null` 만
 * 보고 인메모리로 되돌아간다. 로그는 남기되 사용자 화면은 지키는 게 목적이다.
 *
 * @param label 실패 로그에 찍을 작업 이름
 */
export async function tryDb<T>(
  label: string,
  run: (db: SupabaseClient) => Promise<T>,
): Promise<T | null> {
  const db = getDb();
  if (!db) return null;
  try {
    return await run(db);
  } catch (e) {
    console.error(`[db] ${label} 실패 — 인메모리로 폴백합니다:`, e);
    return null;
  }
}

/**
 * supabase-js 의 `{ data, error }` 를 예외로 바꾼다.
 * `tryDb` 안에서 쓰면 그 예외가 다시 null 폴백으로 흡수된다.
 */
export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/**
 * 사람이 읽는 ID 용 일련번호를 발급한다 (schema.sql 의 railhub_next_seq).
 *
 * ID 문자열을 조립하는 규칙은 **TypeScript 에만** 둔다. SQL 은 번호만 준다.
 * 규칙이 두 군데로 갈라지면 반드시 어긋나기 때문이다.
 */
export type SeqKind = "shipment" | "confirm" | "negotiation" | "application";

export async function nextSeq(kind: SeqKind): Promise<number | null> {
  return tryDb(`nextSeq(${kind})`, async (db) => {
    const n = unwrap(await db.rpc("railhub_next_seq", { kind }));
    return typeof n === "number" ? n : Number(n);
  });
}