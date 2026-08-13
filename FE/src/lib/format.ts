/**
 * 화면 표기용 숫자 포맷. **여기서 계산하지 않습니다** — BE가 준 값을 표기만 바꿉니다.
 * (반올림은 계산이 아니라 표기입니다. 자릿수를 늘리거나 값을 조합하는 일은 BE 몫)
 */

const ko = (n: number, maxFrac = 0) =>
  n.toLocaleString('ko-KR', { maximumFractionDigits: maxFrac });

/** 1_140_000_000 → "11억 4,000만 원" · 64_000_000 → "6,400만 원" · 8_000 → "8,000원" */
export function formatKrw(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  const man = Math.round(abs / 10_000);
  if (man === 0) return `${sign}${ko(abs)}원`;

  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  if (eok === 0) return `${sign}${ko(rest)}만 원`;
  if (rest === 0) return `${sign}${ko(eok)}억 원`;
  return `${sign}${ko(eok)}억 ${ko(rest)}만 원`;
}

/** 40_000 → "4만" · 38_214 → "3.8만" · 45 → "45" — 비유 카드용 축약 표기 */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
  return ko(n);
}

/** 4280 → "4,280톤" (BE가 소수 1자리로 반올림해 주므로 그대로 표기) */
export const formatTon = (n: number) => `${ko(n, 1)}톤`;

/** 245.9 → "245.9 tCO₂eq" — 대시보드 카드용. BE가 소수 1자리로 반올림해 주는 값을 그대로 보존합니다. */
export const formatCo2 = (n: number) => `${ko(n, 1)} tCO₂eq`;

/** 0.74 → "74%" */
export const formatPct = (rate: number) => `${Math.round(rate * 100)}%`;

/** ISO → "2026.08.13 14:32" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "2026-04-01" → "2026. 04. 01." — 서식 문서 표기 */
export const formatDocDate = (ymd: string) => `${ymd.replaceAll('-', '. ')}.`;