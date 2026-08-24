"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBSIDY } from "@railhub/be/constants";
import { AppLayout } from "@/src/components/AppLayout";
import { fetchEsgIndicators, type EsgIndicatorsResponse } from "@/src/lib/esg";
import { formatCompact, formatCo2, formatKrw, formatPct, formatTon } from "@/src/lib/format";
import { BenefitScreen, type BenefitViewData } from "@/src/screens/BenefitScreen";

/**
 * #40 의 summary 는 항목 key·label·금액·출처만 줍니다. 산출 근거(basis) 표기는
 * 화면 카피라 여기서 붙입니다 — 수치가 들어가는 건 ghg(감축량)·accident(트럭 대수)뿐이고
 * 둘 다 summary 의 값을 그대로 표기만 합니다.
 */
function basisFor(key: string, s: EsgIndicatorsResponse["summary"]): string {
  switch (key) {
    case "ghg":
      return formatCo2(s.reducedCo2Ton);
    case "airPollution":
      return "NOx·SOx·PM2.5";
    case "accident":
      return `대형화물차 ${s.truckLoadsAvoided.toLocaleString("ko-KR")}대 감소`;
    case "congestion":
      return "차량·km 감소분";
    case "roadWear":
      return "포장 손상 감소";
    default:
      return "";
  }
}

function toViewData(res: EsgIndicatorsResponse): BenefitViewData {
  const s = res.summary;
  const ratePct = Math.round(SUBSIDY.benefitCapRate * 100);

  return {
    periodLine:
      `${res.period.label} · ${s.tripCount}편성 ${formatTon(s.totalTon)} · ` +
      `계수 ${res.coefficientVersion}${res.verified ? "" : " (1차 출처 검증 전)"}`,

    modeRows: [
      {
        label: "탄소 배출",
        road: formatCo2(s.baselineCo2Ton),
        rail: formatCo2(s.actualCo2Ton),
        railBadge: s.reductionRate > 0 ? `${formatPct(s.reductionRate)} 감소` : undefined,
      },
      { label: "화차 적재율", road: "—", rail: formatPct(s.avgLoadRate) },
      {
        label: "수송 편성",
        road: `트럭 ${s.truckLoadsAvoided.toLocaleString("ko-KR")}대분`,
        rail: `${s.tripCount}편성 ${s.legCount}건`,
      },
    ],

    benefitItems: s.benefitItems.map((item) => ({
      name: item.label,
      basis: basisFor(item.key, s),
      amount: formatKrw(item.amountKrw),
      source: item.source,
    })),

    subsidy: {
      totalLabel: "사회환경적 편익 계",
      total: formatKrw(s.totalBenefitKrw),
      rateLabel: `× ${ratePct}% (공고 상한 기준)`,
      // 표기용 곱셈입니다. 확정 보조금(min(A,B) · 공식 원단위)은 신청서 생성 시 BE가 산정합니다.
      result: formatKrw(Math.round(s.totalBenefitKrw * SUBSIDY.benefitCapRate)),
      basis:
        `${SUBSIDY.legalBasis} — 보조금은 전환 추가비용과 사회환경적 절감비용의 ${ratePct}% 중 ` +
        `작은 값으로 산정됩니다. 표시액은 편익 분해 기준 참고치이며, 확정 상한액은 신청서 생성 시 ` +
        `공고 공식 원단위로 산정됩니다.`,
    },

    analogies: {
      pine: { value: `${formatCompact(s.pineTrees)} 그루`, label: "소나무 식재 효과" },
      truck: { value: `${s.truckLoadsAvoided.toLocaleString("ko-KR")}대`, label: "대형 트럭 도심 진입 차단" },
      note: "국토교통부는 전환교통 지원사업 10년 실적을 나무 3억 그루 식재 효과로 환산해 발표한 바 있습니다.",
    },

    carbonChart: {
      road: { label: "도로 단독", value: formatCo2(s.baselineCo2Ton), ratio: 100 },
      rail: {
        label: "철도 합적",
        value: formatCo2(s.actualCo2Ton),
        ratio: s.baselineCo2Ton > 0 ? Math.round((s.actualCo2Ton / s.baselineCo2Ton) * 100) : 0,
      },
    },
  };
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: BenefitViewData };

export default function Benefit() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    fetchEsgIndicators()
      .then((res) => setState({ status: "ready", data: toViewData(res) }))
      .catch((error: Error) => setState({ status: "error", message: error.message }));
  }, []);

  useEffect(load, [load]);

  if (state.status !== "ready") {
    return (
      <AppLayout active="subsidy">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">이번 전환의 편익</h1>
          {state.status === "loading" ? (
            <p className="text-base text-[#8B95A1]">수송 실적을 집계하는 중…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-base text-[#D22030]">편익 데이터를 불러오지 못했습니다 — {state.message}</p>
              <button
                type="button"
                onClick={load}
                className="self-start rounded-[10px] bg-[#3182F6] px-4 py-2.5 text-[15px] font-bold text-white hover:bg-[#1B64DA]"
              >
                다시 시도
              </button>
            </div>
          )}
        </header>
        {state.status === "loading" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="h-[220px] animate-pulse rounded-[20px] bg-white" />
            <div className="h-[220px] animate-pulse rounded-[20px] bg-white" />
          </div>
        )}
      </AppLayout>
    );
  }

  return <BenefitScreen data={state.data} onNavigate={(to) => router.push(to)} />;
}
