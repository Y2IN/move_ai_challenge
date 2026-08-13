/**
 * 숫자 환각 검출기.
 *
 * 보조금 사업계획서는 관할 지자체에 실제로 제출하는 법정 서식이다.
 * AI가 지어낸 숫자가 한 개라도 들어가면 서비스가 끝난다.
 *
 * 방어는 두 겹이다.
 *   1. 프롬프트로 막는다 — 숫자 생성 금지를 명시 (paragraphs.ts)
 *   2. **출력을 검사한다** — 이 파일. 입력에 없는 숫자가 나오면 재생성한다
 *
 * 2번이 없으면 1번은 지켜졌는지 알 수가 없다.
 *
 * ⚠️ 이 검출기는 LLM 출력만이 아니라 **계약 경계 전체**에 쓸 수 있다.
 *    실제로 개발 중 adapter.ts 가 "0.8 tCO₂eq" 라는 편성 1회분 문자열 옆에
 *    12회분 금액을 인쇄하는 버그를 냈다. 사람이 쓴 코드도 숫자를 틀린다.
 */

/** 문서에 인쇄돼도 되는 숫자 집합 */
export type AllowedNumbers = Set<string>;

/**
 * 문자열에서 숫자 토큰을 뽑는다.
 * 천단위 콤마와 소수점을 포함한 형태를 하나로 잡고, 정규형(콤마 제거)으로 돌려준다.
 */
function extractNumbers(text: string): string[] {
  const raw = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return raw.map(normalize).filter((n) => n.length > 0);
}

/** "1,140,000" → "1140000", "9.50" → "9.5" */
function normalize(token: string): string {
  const cleaned = token.replace(/,/g, "");
  if (!cleaned) return "";
  if (!cleaned.includes(".")) return String(Number(cleaned));
  const n = Number(cleaned);
  return Number.isFinite(n) ? String(n) : cleaned;
}

/** 한 숫자가 문서에 나타날 수 있는 모든 표기 변형 */
function variantsOf(n: number, allowed: AllowedNumbers): void {
  if (!Number.isFinite(n)) return;

  const add = (v: number | string) => {
    const s = typeof v === "number" ? String(v) : v;
    if (s && s !== "NaN") allowed.add(s);
  };

  add(n);
  add(Math.round(n));
  add(Math.round(n * 10) / 10); // 소수 첫째자리 — "9.5 tCO₂eq"
  add(Math.round(n * 100) / 100);
  add(Math.abs(n)); // 음수 금액이 "△93,000,000" 처럼 부호 없이 인쇄된다
  add(Math.round(Math.abs(n)));

  // 비율 → 퍼센트. 0.7305 가 문서에서는 "73%" 로 나온다
  if (n > 0 && n <= 1) {
    add(Math.round(n * 100));
    add(Math.round(n * 1000) / 10);
  }

  // 억/만 단위 분해. "1,140,000,000원" 이 "11억 4,000만 원" 으로 쓰인다
  const abs = Math.abs(Math.round(n));
  if (abs >= 10_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.floor((abs % 100_000_000) / 10_000);
    if (eok > 0) {
      add(eok);
      add(Math.round(abs / 100_000_000));
      add(Math.round((abs / 100_000_000) * 10) / 10);
    }
    if (man > 0) add(man);
    add(Math.floor(abs / 10_000)); // 만 단위 절삭 표기
    add(Math.round(abs / 10_000));
  }
}

/**
 * `ReportInput` 같은 객체를 재귀 순회해서 인쇄 가능한 숫자를 전부 모은다.
 *
 * **문자열 안의 숫자도 넣는다.** 근거 조문("제21조"), 기간 라벨("2026년 2분기"),
 * 계수 버전("railhub-2026.2") 이 전부 문서에 인용되기 때문이다.
 * 이걸 빼면 정상 문장이 환각으로 잡힌다.
 */
export function collectAllowedNumbers(value: unknown): AllowedNumbers {
  const allowed: AllowedNumbers = new Set();

  const walk = (v: unknown): void => {
    if (v === null || v === undefined) return;
    if (typeof v === "number") {
      variantsOf(v, allowed);
      return;
    }
    if (typeof v === "string") {
      for (const token of extractNumbers(v)) {
        allowed.add(token);
        const n = Number(token);
        if (Number.isFinite(n)) variantsOf(n, allowed);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };

  walk(value);
  return allowed;
}

export interface HallucinationReport {
  clean: boolean;
  /** 입력에 근거가 없는 숫자들 */
  offenders: string[];
  /** 사람이 읽을 사유 */
  message: string;
}

/**
 * 생성된 문장에서 입력에 근거가 없는 숫자를 찾는다.
 *
 * 한 자리 수는 검사하지 않는다. 서수("3개 품목"), 조사 섞인 표현에서
 * 오탐이 압도적으로 많고, 한 자리 수를 지어내는 것으로 문서가 틀어지는 경우는 드물다.
 * 두 자리 이상은 전부 검사한다 — "45대", "74%" 를 놓치면 안 된다.
 */
export function findHallucinatedNumbers(
  text: string,
  allowed: AllowedNumbers,
): HallucinationReport {
  const offenders = [
    ...new Set(
      extractNumbers(text)
        .filter((n) => n.replace(".", "").replace("-", "").length >= 2)
        .filter((n) => !allowed.has(n)),
    ),
  ];

  return {
    clean: offenders.length === 0,
    offenders,
    message: offenders.length
      ? `입력에 근거가 없는 숫자 ${offenders.length}개: ${offenders.join(", ")}`
      : "모든 숫자가 입력에 근거합니다.",
  };
}

/** 문단 하나를 검사하는 편의 함수 */
export function verifyParagraph(
  text: string,
  source: unknown,
): HallucinationReport {
  return findHallucinatedNumbers(text, collectAllowedNumbers(source));
}
