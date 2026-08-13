/**
 * 랜딩(로그인 전) 공개 수치 — #6 GET /api/public/stats.
 *
 * 대시보드 큐레이션 집계(seed.dashboard)를 재사용한다. breakdown 의 표시 문자열은
 * 편익 금액(amountKrw)에서 포맷터로 뽑으므로 값이 한 곳(seed)에서만 관리된다.
 */

import { seed } from "./seed";
import type { PublicStats, SeedData } from "./types";

export function getPublicStats(data: SeedData = seed): PublicStats {
  const d = data.dashboard;
  return {
    quarterSubsidy: d.subsidyEstimate,
    breakdown: d.benefit.breakdown.map((b) => ({
      key: b.key,
      label: b.label,
      value: formatKrwShort(b.amountKrw),
      amountKrw: b.amountKrw,
      quantity: b.quantity,
    })),
    cumulative: d.cumulative,
    equivalents: d.equivalents,
  };
}

/** 158000000 → "1억 5,800만" (억·만 단위, 0인 자리는 생략) */
function formatKrwShort(n: number): string {
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString("en-US")}만`);
  return parts.join(" ") || "0";
}
