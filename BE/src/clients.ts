/**
 * 코레일 화주 · 영업 (GET /api/korail/clients).
 *
 * 화주가 **약속한 물량**(seed.shippers[].contract)과 **실제로 실은 물량**
 * (수송 실적 원장)을 맞대어 이행률을 냅니다. 둘을 같은 파일에 두지 않는 이유는,
 * 한 곳에서 관리하면 약속과 실적이 어긋나도 드러나지 않기 때문입니다.
 *
 * 이행률·상태·재계약 D-day 는 전부 **여기서 계산**합니다. 화면이 계산하면
 * 같은 규칙이 두 군데 생기고, 한쪽만 고치는 순간 갈라집니다.
 */

import { aggregate, customPeriod } from "./esg/period";
import { seed } from "./seed";
import type { CompanyGrade, SeedData } from "./types";

/** 이행률이 이 아래면 미달 위험. 협약 감액의 경계선입니다. */
export const RISK_RATE = 0.8;

/** 재계약 기한이 이 안쪽이면 영업 대상으로 올립니다. */
export const RENEWAL_WINDOW_DAYS = 60;

export type ClientStatus = "정상" | "미달 위험" | "신규";

export interface ClientRow {
  id: string;
  name: string;
  industry: string;
  companyGrade: CompanyGrade;
  esgDisclosureRequired: boolean;
  /** 주 노선. 원장 실적에서 가장 많이 쓴 구간 */
  route: string | null;
  contractNo: string;
  contractTon: number;
  actualTon: number;
  /** 이행률 = 실적 / 협약 */
  rate: number;
  /** 참여한 편성 수 — 공차를 몇 번 채워 줬는지 */
  tripCount: number;
  /** 이 화주 몫의 탄소 감축 */
  reducedCo2Ton: number;
  status: ClientStatus;
  /** 재계약까지 남은 일수. 지났으면 음수 */
  renewalInDays: number;
}

export interface ClientStat {
  key: string;
  label: string;
  value: number;
  unit: "count";
  note: string;
}

export interface ClientsResponse {
  period: { from: string; to: string; label: string };
  stats: ClientStat[];
  items: ClientRow[];
  riskRate: number;
}

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * 실적이 아직 한 건도 없는 화주는 '미달 위험'이 아니라 '신규'입니다.
 * 이행률 0% 를 위험으로 올리면 영업 목록 맨 위가 방금 계약한 화주로 찹니다.
 */
function statusOf(rate: number, tripCount: number): ClientStatus {
  if (tripCount === 0) return "신규";
  return rate < RISK_RATE ? "미달 위험" : "정상";
}

export function getClients(now: Date = new Date(), data: SeedData = seed): ClientsResponse {
  // 협약 기간은 화주마다 같게 운영합니다. 첫 화주 것을 기준 기간으로 씁니다.
  const first = data.shippers[0]?.contract;
  const from = first?.periodFrom ?? "2026-01-01";
  const to = first?.periodTo ?? "2026-12-31";
  const period = customPeriod(from, to);

  const items: ClientRow[] = data.shippers.map((shipper) => {
    const agg = aggregate({ period, shipperId: shipper.id });
    const contractTon = shipper.contract.contractTon;
    const rate = contractTon > 0 ? agg.totalTon / contractTon : 0;

    return {
      id: shipper.id,
      name: shipper.name,
      industry: shipper.industry,
      companyGrade: shipper.companyGrade,
      esgDisclosureRequired: shipper.esgDisclosureRequired,
      // 원장 명세의 노선은 전부 같은 구간이라 첫 행이 곧 주 노선입니다.
      route: agg.rows[0]?.route ?? null,
      contractNo: shipper.contract.no,
      contractTon,
      actualTon: agg.totalTon,
      rate: Math.round(rate * 1000) / 1000,
      tripCount: agg.tripCount,
      reducedCo2Ton: agg.reducedCo2Ton,
      status: statusOf(rate, agg.tripCount),
      renewalInDays: daysBetween(now, new Date(shipper.contract.renewalDueDate)),
    };
  });

  // 미달 위험이 위로, 그다음 이행률 낮은 순 — 담당자가 먼저 볼 것부터.
  items.sort((a, b) => {
    const risk = (r: ClientRow) => (r.status === "미달 위험" ? 0 : 1);
    return risk(a) - risk(b) || a.rate - b.rate;
  });

  const renewals = items.filter(
    (i) => i.renewalInDays >= 0 && i.renewalInDays <= RENEWAL_WINDOW_DAYS,
  );

  const stats: ClientStat[] = [
    {
      key: "participating",
      label: "합적 참여 화주",
      value: items.filter((i) => i.tripCount > 0).length,
      unit: "count",
      note: `${period.label} 누적`,
    },
    {
      key: "newShippers",
      label: "신규 화주",
      value: items.filter((i) => i.status === "신규").length,
      unit: "count",
      note: "아직 실적이 없는 협약",
    },
    {
      key: "renewal",
      label: "재계약 대상",
      value: renewals.length,
      unit: "count",
      note: `${RENEWAL_WINDOW_DAYS}일 내 협약 만료`,
    },
    {
      key: "risk",
      label: "미달 위험 화주",
      value: items.filter((i) => i.status === "미달 위험").length,
      unit: "count",
      note: `이행률 ${Math.round(RISK_RATE * 100)}% 미만`,
    },
  ];

  return {
    period: { from: period.from, to: period.to, label: period.label },
    stats,
    items,
    riskRate: RISK_RATE,
  };
}
