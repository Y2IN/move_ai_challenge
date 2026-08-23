/**
 * api_list #30 — 신청서 생성 전 사전 점검.
 *
 * ## 왜 만들었나
 *
 * 06a 의 "무엇이 만들어지나요" 체크리스트가 `mocks/apply.ts` 의 **고정 문구**였다.
 * "정산 데이터 준비 완료" 같은 줄이 실제로 데이터가 없어도 항상 초록색으로 떴다 —
 * 점검 화면이 점검을 안 하고 있었던 셈이다.
 *
 * 여기서는 실제로 확인한다. 각 항목은 세 상태 중 하나다:
 *
 *   ready    지금 값이 있고 서식에 그대로 들어간다 (근거 수치를 함께 준다)
 *   pending  생성해야 나온다 (AI 서술처럼 정상적으로 비어 있는 것)
 *   blocked  이대로 만들면 서식이 빈다 — 사용자가 먼저 해결해야 한다
 *
 * 문구를 화면에 두지 않고 서버가 주는 이유는, 판정 근거(집계·계수·산식)가 전부
 * 서버에 있기 때문이다. 화면이 다시 판정하면 같은 규칙이 두 벌이 된다.
 */

import { COEFFICIENT_VERSION, SUBSIDY } from "./constants";
import { loadLedger } from "./db/ledger";
import { loadUniverse } from "./db/universe";
import { aggregateWith } from "./esg/query";
import { latestConfirmation } from "./store";

export type PreflightState = "ready" | "pending" | "blocked";

export interface PreflightItem {
  key: string;
  title: string;
  desc: string;
  state: PreflightState;
  /** 화면에 그대로 인쇄되는 판정 결과 */
  status: string;
  /** AI 가 쓰는 항목인지 (배지) */
  ai?: boolean;
}

export interface PreflightResponse {
  period: { id: string; label: string; from: string; to: string };
  applicant: string | null;
  items: PreflightItem[];
  /** 하나라도 blocked 면 여기에 사유가 담긴다. 비어 있으면 생성 가능 */
  blockers: string[];
  /** 생성 예상 소요 (문단 병렬 호출 기준) */
  estimatedSeconds: number;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export async function getPreflight(query: { period?: string | null } = {}): Promise<PreflightResponse> {
  const [data, ledger] = await Promise.all([loadUniverse(), loadLedger()]);
  const agg = aggregateWith({ period: query.period }, ledger, data);
  const confirmed = await latestConfirmation();

  const items: PreflightItem[] = [
    {
      key: "plan",
      title: "전환 계획",
      desc: "노선·품목·전환물량·수송횟수 표 자동 구성",
      ...(agg.tripCount > 0
        ? {
            state: "ready" as const,
            status: `운송 실적 ${agg.tripCount.toLocaleString("ko-KR")}건 · ${agg.totalTon.toLocaleString("ko-KR")}톤 연동됨`,
          }
        : {
            state: "blocked" as const,
            status: "이 기간에 집계할 수송 실적이 없습니다",
          }),
    },
    {
      key: "extraCost",
      title: "추가비용 산출",
      desc: "철도수송비·상하역비·셔틀비에서 도로수송비 차감",
      // 추가비용은 **확정 편성의 계산 결과**에서 나온다. 확정이 없으면 서식이
      // fixture 로 떨어지므로(report/source.ts) 그 사실을 미리 알린다.
      ...(confirmed?.calc
        ? {
            state: "ready" as const,
            // 철도가 더 비싼 구간도 있다. 음수를 "절감"이라고 쓰면 서식과 반대말이 된다
            // (그 차액이 곧 보조금 대상인 '전환 추가비용'이다).
            status: (() => {
              const diff = confirmed.calc!.cost.roadOnlyKrw - confirmed.calc!.cost.railPooledKrw;
              const label = diff >= 0 ? `도로 대비 ${won(diff)} 절감` : `전환 추가비용 ${won(-diff)}`;
              return `확정 편성 ${confirmed.groupId} 기준 · ${label}`;
            })(),
          }
        : {
            state: "pending" as const,
            status: "확정된 편성이 없어 예시 편성으로 산출됩니다",
          }),
    },
    {
      key: "benefit",
      title: "사회환경적 편익",
      desc: "탄소·대기오염·교통사고·도로혼잡 4개 항목 산정",
      ...(agg.totalBenefitKrw > 0
        ? {
            state: "ready" as const,
            status: `${won(agg.totalBenefitKrw)} · 계수 ${COEFFICIENT_VERSION} 적용`,
          }
        : {
            state: "blocked" as const,
            status: "편익을 산정할 실적이 없습니다",
          }),
    },
    {
      key: "subsidy",
      title: "보조금 산정액",
      desc: `추가비용과 편익의 ${Math.round(SUBSIDY.benefitCapRate * 100)}% 중 작은 값으로 상한 산정`,
      state: "ready",
      // legalBasis 는 근거 조문을 전부 나열한 긴 문자열이라 배지에 그대로 넣으면
      // 줄이 넘친다. 서식 본문에는 전문이 들어가고 여기서는 첫 근거만 보여준다.
      status: `${SUBSIDY.legalBasis.split(" · ")[0]} 산식`,
    },
    {
      key: "narrative",
      title: "서술 문단",
      desc: "산출된 수치를 근거로 사업 개요·기대효과 문장 작성",
      state: "pending",
      status: "생성 시 작성됩니다",
      ai: true,
    },
  ];

  return {
    period: agg.period,
    applicant: agg.shipperName ?? data.accounts.corp?.org ?? null,
    items,
    blockers: items.filter((i) => i.state === "blocked").map((i) => `${i.title} — ${i.status}`),
    estimatedSeconds: 10,
  };
}
