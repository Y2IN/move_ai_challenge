/**
 * 라우트 공용 헬퍼 — 본문 파싱과 표준 에러 응답을 한 곳에 둔다.
 * (여러 route.ts 가 같은 try/catch·400 형태를 복붙하던 것을 대체)
 */

export type ParsedBody =
  | { kind: "empty" } // 본문 없음/공백
  | { kind: "json"; value: unknown } // 정상 JSON
  | { kind: "invalid" }; // 본문은 있으나 JSON 파싱 실패

/**
 * 요청 본문을 읽어 세 갈래로 구분한다.
 * 빈 본문과 "깨진 JSON" 을 구분하는 게 핵심 — 후자는 400 으로 돌려줘야 한다
 * (req.json() 만 쓰면 둘 다 예외라 구분이 안 된다).
 */
export async function readBody(req: Request): Promise<ParsedBody> {
  const text = await req.text();
  if (text.trim() === "") return { kind: "empty" };
  try {
    return { kind: "json", value: JSON.parse(text) };
  } catch {
    return { kind: "invalid" };
  }
}

/** 값이 "빈 객체"인가 — null/undefined/{} 는 true, 배열·비객체·비어있지-않은-객체는 false. */
export function isEmptyObject(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  return Object.keys(v).length === 0;
}

/** 쿼리 문자열을 양의 정수로. 없거나 부적절하면 undefined (호출부가 기본값을 쓰도록). */
export function toPositiveInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 본문 JSON 파싱 실패 응답 (400) */
export function badJson(): Response {
  return Response.json({ error: "본문(JSON)을 파싱할 수 없습니다." }, { status: 400 });
}

/** 입력 검증 실패 응답 (400) — 필드별 오류 포함 */
export function validationError(fields: Record<string, string>): Response {
  return Response.json({ error: "입력값이 올바르지 않습니다.", fields }, { status: 400 });
}
