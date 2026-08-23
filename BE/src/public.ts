/**
 * 랜딩(로그인 전) 공개 수치 — #6 GET /api/public/stats.
 *
 * ## 왜 seed.dashboard 를 쓰지 않는가
 *
 * 예전에는 `seed.dashboard` 의 큐레이션 상수(보조금 3억 4,200만 · 편익 11억)를 그대로
 * 내보냈다. 그런데 `/benefit` · ESG 리포트 · 사업계획서는 전부 수송 실적 원장을
 * 집계해서 계산하므로, **랜딩에서 본 금액과 로그인 후 화면의 금액이 갈라졌다.**
 * 심사자가 랜딩의 숫자를 보고 한 번 클릭하면 자릿수가 다른 값을 본다.
 *
 * 그래서 여기도 같은 집계(`resolveAggregate`)에서 뽑는다. 값이 한 곳에서만 나온다.
 * (반대 방향도 맞춰 뒀다 — 홈 대시보드가 읽는 `seed.dashboard` 는 이제 큐레이션
 * 상수가 아니라 같은 집계의 사본이다. 자세한 건 `dashboard.ts` 머리말.)
 *
 * ## 왜 보조금이 아니라 편익인가
 *
 * 시드 기준으로 **전환 추가비용(A)이 음수**다 — 철도 합적이 도로 직행보다 싸게 나온다.
 * 고시상 보조금은 추가비용을 보전하는 제도라 추가비용이 없으면 대상이 아니고,
 * 실제 산정 결과도 `eligible: false · subsidy: 0` 이다.
 * 랜딩에서 "이번 분기 보조금 예상액"을 크게 띄우면 클릭 한 번에 정반대 숫자가 나온다.
 *
 * 대신 **사회환경적 편익 환산액**을 띄운다. 이건 실제로 양수이고, 계산 근거가 있고,
 * 제품 서사("빈 화차를 채우고 그 기록을 ESG 자산으로 환전한다")와도 맞는다.
 * 보조금 대상 여부는 로그인 후 사업계획서에서 산정 결과 그대로 보여준다.
 */

import { resolveAggregate } from "./esg/query";
import { seed } from "./seed";
import type { BenefitBreakdownItem } from "./esg/types";
import type { PublicStats, PublicStatsBreakdownItem } from "./types";

/**
 * 편익 항목의 물리량 표기. 금액과 달리 항목마다 단위가 달라 집계에서 바로 못 뽑는다.
 * **여기서 새 수치를 만들지 않는다** — 집계에 이미 있는 값을 문자열로 옮길 뿐이다.
 */
function quantityOf(
  item: BenefitBreakdownItem,
  agg: { reducedCo2Ton: number; truckLoadsAvoided: number },
): string {
  switch (item.key) {
    case "ghg":
      return `${agg.reducedCo2Ton.toLocaleString("ko-KR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} tCO₂eq`;
    case "airPollution":
      return "NOx·SOx·PM2.5";
    case "accident":
      return `대형화물차 ${agg.truckLoadsAvoided.toLocaleString("ko-KR")}대 감소`;
    case "congestion":
      return "차량·km 감소분";
    case "roadWear":
      return "포장 손상 감소";
    default:
      return "";
  }
}

/** "2026Q2" → "2026Q1", "2026Q1" → "2025Q4". 분기 형식이 아니면 null (비교를 포기한다) */
function previousQuarterId(periodId: string): string | null {
  const m = /^(\d{4})Q([1-4])$/.exec(periodId);
  if (!m) return null;
  const year = Number(m[1]);
  const q = Number(m[2]);
  return q === 1 ? `${year - 1}Q4` : `${year}Q${q - 1}`;
}

export function getPublicStats(): PublicStats {
  const agg = resolveAggregate({});

  // 전 분기 대비 증감률. **비교 대상이 없으면 지어내지 않고 생략한다.**
  // 직전 분기 실적이 0인데 "+100%" 같은 걸 띄우면 없는 성장을 주장하게 된다.
  let deltaPct: number | undefined;
  const prevId = previousQuarterId(agg.period.id);
  if (prevId) {
    try {
      const prev = resolveAggregate({ period: prevId });
      if (prev.totalBenefitKrw > 0) {
        deltaPct = Math.round(
          ((agg.totalBenefitKrw - prev.totalBenefitKrw) / prev.totalBenefitKrw) * 100,
        );
      }
    } catch {
      // 원장에 그 분기가 없으면 비교를 생략한다. 랜딩이 죽을 이유는 아니다.
    }
  }

  const breakdown: PublicStatsBreakdownItem[] = agg.benefitItems.map((item) => ({
    key: item.key,
    label: item.label,
    value: formatKrwShort(item.amountKrw),
    amountKrw: item.amountKrw,
    quantity: quantityOf(item, agg),
  }));

  return {
    periodLabel: agg.period.label,
    quarterBenefit: {
      amount: agg.totalBenefitKrw,
      label: formatKrwShort(agg.totalBenefitKrw),
      deltaPct,
    },
    breakdown,
    // 플랫폼 누적 실적은 원장 한 분기로 계산할 수 있는 값이 아니다. 시드의 서비스
    // 소개용 수치를 그대로 쓴다 (seed.meta.fictional 로 가공 데이터임을 표시한다).
    cumulative: seed.dashboard.cumulative,
    equivalents: { pineTrees: agg.pineTrees, trucksBlocked: agg.truckLoadsAvoided },
  };
}

/** 342004280 → "3억 4,200만" · 2064641 → "206만" (억·만 단위, 0인 자리는 생략) */
function formatKrwShort(n: number): string {
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString("en-US")}만`);
  // 만 원 미만은 억·만 자리가 둘 다 0이라 "0" 이 된다. 원 단위로 떨어뜨린다.
  return parts.join(" ") || n.toLocaleString("ko-KR");
}
