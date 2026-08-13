/**
 * API 클라이언트 공통 코어.
 *
 * 화면은 `lib/*.ts` 의 함수만 알면 됩니다 — 엔드포인트 경로·에러 모양이 바뀌면
 * 그 파일 한 곳만 고칩니다. 이 파일은 그 클라이언트들이 공유하는 fetch·에러 규약입니다.
 *
 * BE 는 실패를 `{ error: string }` 으로 돌려줍니다. 그 문장이 사용자에게 보여줄
 * 한국어 메시지이므로 상태 코드 문구로 덮어쓰지 않고 그대로 올립니다.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 응답 본문의 `error` 를 우선 쓰고, JSON 이 아니면 상태 코드 문구로 갈음합니다. */
export async function throwFrom(res: Response): Promise<never> {
  let message = `요청이 실패했습니다 (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // JSON 이 아니면 상태 코드 문구를 그대로 씁니다.
  }
  throw new ApiError(message, res.status);
}

/**
 * 조회. 대시보드·목록은 시연 중에 값이 바뀌므로 캐시하지 않습니다
 * (랜딩 #6 만 라우트 자체가 60초 캐시를 붙여 응답합니다).
 */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) await throwFrom(res);
  return (await res.json()) as T;
}

/** 등록·실행. body 를 생략하면 빈 객체를 보냅니다 (BE 가 빈 본문과 깨진 JSON 을 구분합니다). */
export async function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwFrom(res);
  return (await res.json()) as T;
}
