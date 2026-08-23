/**
 * 조건 조율 에이전트 (api_list #21~#26).
 *
 * 매칭이 정원 미달로 깨졌을 때, 화주들에게 조건을 조금씩 바꿔달라고 협상해서
 * 편성을 살려낸다. 이 서비스에서 **LLM 없이는 성립하지 않는 유일한 기능**이다.
 *
 * ## 역할 분담 — 이 경계가 제품 품질을 가른다
 *
 *   결정론적 계산 (이 파일)   누가 뭘 양보하면 성립하는지 · 그 양보가 이득인지
 *   LLM (Gemini)             화주별 설득 문장
 *
 * 화면에 **"양보 대가가 절감액보다 큰 화주에게는 제안하지 않습니다"** 가 명시돼 있다.
 * 이건 **LLM에게 맡기면 안 되는 판단**이다. 보관비 62만원 vs 절감 218만원 같은 비교는
 * 서버에서 먼저 걸러내고, LLM은 통과한 건에 대해서만 문장을 쓴다.
 * 이 순서가 뒤집히면 화주에게 손해 보는 제안을 보내게 된다.
 */

import { generateText, isLlmConfigured } from "./llm";
import { STORAGE_COST_KRW_PER_TON_DAY } from "./constants";
import {
  buildCalc,
  match,
  normalizeInput,
  scheduleFits,
  wagonViolation,
  type MatchResult,
} from "./matching";
import type { CalcResult, SeedData, Shipment, ShipmentInput } from "./types";

/** 화주에게 요청할 양보의 종류 */
export type Lever =
  | "DEPART_DATE_SHIFT" // 발송일 이동
  | "VOLUME_PULL_IN" // 예정 물량 당기기
  | "DELIVERY_STATION_CHANGE"; // 인도역 변경

export interface ConcessionOption {
  shipmentId: string;
  shipperId: string;
  shipperName: string;
  lever: Lever;
  /** 무엇을 양보해야 하는지 */
  ask: string;
  /** 어긋난 조건 (왜 지금은 못 타는지) */
  conflict: string;
  weightTon: number;
  /** 이 양보를 하면 화주가 부담하는 비용 (보관비 등) */
  concessionCostKrw: number;
  /** 이 양보로 화주가 얻는 절감액 */
  savingKrw: number;
  /** 순이득 = 절감 − 대가. **음수면 제안하지 않는다** */
  netGainKrw: number;
  /** 결정론적 게이트 통과 여부 */
  worthwhile: boolean;
  /** 통과하지 못한 이유 */
  rejectReason: string | null;
}

export interface Proposal extends ConcessionOption {
  /** 화주에게 보낼 설득 메시지 */
  message: string;
  source: "ai" | "fallback";
}

export interface NegotiationResult {
  /** 조율 전 상태 */
  before: { totalTon: number; capacityTon: number; loadRate: number; shortfallTon: number };
  /** 조율안을 전부 수락했을 때 */
  after: { totalTon: number; loadRate: number; shortfallTon: number } | null;
  /** 검토했지만 제안하지 않은 것 (이유 포함) */
  rejected: ConcessionOption[];
  proposals: Proposal[];
  /** 성립 가능한가 */
  feasible: boolean;
  message: string;
}

// ── 1. 양보 후보 탐색 (결정론적) ───────────────────────────────

/**
 * 정원을 못 채운 편성에 대해, 누가 뭘 양보하면 채울 수 있는지 찾는다.
 *
 * 지금은 "예정 물량 당기기" 한 가지 lever 만 시드에 있다.
 * 발송일 이동·인도역 변경은 시드에 해당 데이터가 생기면 같은 형태로 붙는다.
 */
export function findConcessions(
  seed: SeedData,
  current: MatchResult,
  input: ShipmentInput | null,
  now: Date = new Date(),
): ConcessionOption[] {
  if (!current.wagon || current.shortfallTon <= 0) return [];

  const options: ConcessionOption[] = [];
  const departDate = new Date(current.wagon.departure.date);
  

  const wagon = current.wagon;

  for (const s of seed.shipments) {
    if (s.status !== "scheduled" || !s.pullForwardEligible) continue;

    // **실제로 이 편성에 탈 수 있는 화물인지 먼저 본다.**
    // 노선·화차 물리요건·일정 제약을 검사하지 않으면, 수락해도 매칭에서 다시
    // 걸러지는 화주에게 양보를 요구하게 된다 — 화주는 헛되이 양보하는 셈이다.
    if (s.origin.stationId !== current.lane?.originStationId) continue;
    if (s.destination.stationId !== current.lane?.destStationId) continue;

    // 물량을 당기면 출발일이 화차 시각표에 맞춰지므로, 일정 제약은
    // 당긴 뒤 기준으로 판정한다. 나머지(도착기한·주말)는 그대로 적용된다.
    const pulled: Shipment = {
      ...s,
      schedule: { ...s.schedule, requestedDepartureDate: wagon.departure.date },
    };
    if (!scheduleFits(pulled, wagon)) continue;

    // 화차 물리요건 — 유개 필요 화물을 무개화차에 붙이면 안 된다
    const currentMembers = seed.shipments.filter((x) =>
      current.members.some((m) => m.shipmentId === x.id),
    );
    if (wagonViolation(wagon, [...currentMembers, s])) continue;

    const scheduled = new Date(s.schedule.requestedDepartureDate);
    const pullDays = Math.round(
      (scheduled.getTime() - departDate.getTime()) / 86_400_000,
    );
    if (pullDays <= 0) continue; // 이미 지났거나 당길 필요 없음

    // 물량을 당기면 그만큼 창고에 더 오래 두지 않아도 되지만,
    // 반대로 출하 준비를 앞당겨야 하므로 보관·인력 비용이 든다.
    const concessionCostKrw = Math.round(
      s.cargo.weightTon * pullDays * STORAGE_COST_KRW_PER_TON_DAY,
    );

    const savingKrw = estimateSaving(seed, current, input, s);
    const netGainKrw = savingKrw - concessionCostKrw;

    const shipper = seed.shippers.find((sp) => sp.id === s.shipperId);
    options.push({
      shipmentId: s.id,
      shipperId: s.shipperId,
      shipperName: shipper?.name ?? s.shipperName ?? s.shipperId,
      lever: "VOLUME_PULL_IN",
      ask: `${s.schedule.requestedDepartureDate} 예정 물량 ${s.cargo.weightTon}톤을 ${wagon.departure.date} 편성으로 ${pullDays}일 당기기`,
      conflict: `${s.schedule.requestedDepartureDate} 예정 물량이라 이번 편성 대상이 아님`,
      weightTon: s.cargo.weightTon,
      concessionCostKrw,
      savingKrw,
      netGainKrw,
      // 결정론적 게이트 — 여기를 통과해야 LLM이 문장을 쓴다
      // 물리·일정 요건은 위에서 이미 걸렀으므로, 남은 판정은 **경제성뿐**입니다.
      worthwhile: netGainKrw > 0,
      rejectReason:
        netGainKrw <= 0
          ? `양보 대가(${concessionCostKrw.toLocaleString("ko-KR")}원)가 절감액(${savingKrw.toLocaleString("ko-KR")}원)보다 커서 제안하지 않습니다`
          : null,
    });
  }

  // 순이득이 큰 순서로
  return options.sort((a, b) => b.netGainKrw - a.netGainKrw);
}

/**
 * 이 화물이 편성에 합류했을 때 **본인이** 얼마를 아끼는지.
 *
 * 단독 도로 운송 대비 합적 철도 분담액의 차이다.
 * 편성 전체 절감이 아니라 그 화주 몫만 본다 — 남의 이득으로 설득하면 안 된다.
 */
function estimateSaving(
  seed: SeedData,
  current: MatchResult,
  input: ShipmentInput | null,
  candidate: Shipment,
): number {
  if (!current.wagon) return 0;

  // 사용자가 방금 등록한 화물은 seed.shipments 에 없다(메모리에만 존재).
  // seed 만 훑으면 그 톤수가 빠진 편성으로 분담률을 계산해서, 화주에게 보내는
  // 절감액이 실제와 달라진다. 매칭이 실제로 태운 멤버를 그대로 쓴다.
  const userShipment = input ? normalizeInput(input, seed) : null;
  const pool = [...seed.shipments, ...(userShipment ? [userShipment] : [])];

  const members = current.members
    .map((m) => pool.find((s) => s.id === m.shipmentId))
    .filter((s): s is Shipment => Boolean(s));

  if (members.some((m) => m.id === candidate.id)) return 0; // 이미 편성에 있음
  members.push(candidate);

  const calc = buildCalc(members, current.wagon, current.lane, seed);
  return calc.shares.find((s) => s.shipmentId === candidate.id)?.savingKrw ?? 0;
}

// ── 2. 설득 메시지 생성 (LLM) ──────────────────────────────────

const SYSTEM_PROMPT = `너는 화물 합적 플랫폼의 조율 담당자다. 화주에게 조건 변경을 요청하는 짧은 메시지를 쓴다.

절대 규칙:
1. **주어진 수치만 쓴다.** 새 숫자를 만들거나 계산하지 마라.
2. 그 화주에게 돌아가는 이득을 근거로 설득한다. 다른 화주의 이득을 말하지 마라.
3. 요청하는 양보를 **구체적으로** 적는다. 두루뭉술하게 쓰지 마라.
4. 2~3문장. 존댓말. 과장·읍소·압박 금지.
5. 메시지 본문만 출력한다. 제목·인사말·서명을 붙이지 마라.`;

function buildPrompt(o: ConcessionOption): string {
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  return [
    `[받는 화주] ${o.shipperName}`,
    `[요청할 양보] ${o.ask}`,
    `[현재 걸림돌] ${o.conflict}`,
    "",
    "[이 화주에게 돌아가는 숫자]",
    `  - 물량: ${o.weightTon}톤`,
    `  - 합류 시 절감액: ${won(o.savingKrw)}`,
    `  - 양보에 드는 비용(보관·출하 조정): ${won(o.concessionCostKrw)}`,
    `  - 순이득: ${won(o.netGainKrw)}`,
    "",
    "[작성 지시]",
    "위 양보를 요청하는 메시지를 써라. 순이득이 남는다는 점이 드러나야 한다.",
  ].join("\n");
}

function fallbackMessage(o: ConcessionOption): string {
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  return (
    `${o.shipperName}님, ${o.ask}를 요청드립니다. ` +
    `합류하시면 운송비 ${won(o.savingKrw)}을 절감하실 수 있고, ` +
    `출하 조정에 드는 비용 ${won(o.concessionCostKrw)}을 제하면 ${won(o.netGainKrw)}이 남습니다.`
  );
}

/** 게이트를 통과한 후보에 대해서만 설득 메시지를 만든다. 병렬 호출. */
export async function generateProposals(
  options: ConcessionOption[],
): Promise<Proposal[]> {
  const worthwhile = options.filter((o) => o.worthwhile);
  const configured = isLlmConfigured();

  return Promise.all(
    worthwhile.map(async (o): Promise<Proposal> => {
      if (!configured) return { ...o, message: fallbackMessage(o), source: "fallback" };
      try {
        const text = await generateText({
          system: SYSTEM_PROMPT,
          prompt: buildPrompt(o),
          maxTokens: 512,
          // 짧은 설득 문장이라 깊은 추론이 필요 없다. 화주 수만큼 병렬로 나가므로
          // 여기서 지연을 줄이는 게 전체 응답 시간에 그대로 반영된다.
          thinking: "low",
          // 타임아웃이 없으면 한 화주의 호출이 늘어질 때 Promise.all 이 통째로 걸려
          // Vercel 함수 한도(60s)를 넘고 504 가 난다 — 폴백 문장조차 못 싣는다.
          timeoutMs: 20_000,
        });
        return { ...o, message: text, source: "ai" };
      } catch {
        return { ...o, message: fallbackMessage(o), source: "fallback" };
      }
    }),
  );
}

// ── 3. 한 번에 ─────────────────────────────────────────────────

export async function negotiate(
  seed: SeedData,
  input: ShipmentInput | null,
  now: Date = new Date(),
): Promise<NegotiationResult> {
  const current = match(seed, input, now);
  const before = {
    totalTon: current.totalTon,
    capacityTon: current.capacityTon,
    loadRate: current.loadFactor,
    shortfallTon: current.shortfallTon,
  };

  // 배정 가능한 공차 자체가 없으면 조율로 살릴 수 없다. 예전에는 여기서
  // feasible:true 를 돌려줘 화면의 "편성 확정하기" 버튼이 활성화됐고,
  // 누르면 확정 API 가 409 를 돌려줘 에러 화면으로 떨어졌다.
  if (!current.wagon) {
    return {
      before,
      after: null,
      rejected: [],
      proposals: [],
      feasible: false,
      message: current.message || "조건에 맞는 공차가 없습니다. 다음 공차 일정을 확인하세요.",
    };
  }

  if (current.shortfallTon <= 0) {
    return {
      before,
      after: null,
      rejected: [],
      proposals: [],
      feasible: true,
      message: "정원이 이미 충족되어 조율이 필요하지 않습니다.",
    };
  }

  // 마감 후 최소 적재율로 이미 성립한 편성 — 자리는 남았지만 더 모을 시간이 없다.
  if (current.status === "matched") {
    return {
      before,
      after: null,
      rejected: [],
      proposals: [],
      feasible: true,
      message: `편성이 이미 성립했습니다 (적재율 ${Math.round(current.loadFactor * 100)}%). 모집이 마감되어 추가 합적 없이 출발합니다.`,
    };
  }

  const options = findConcessions(seed, current, input, now);
  const proposals = await generateProposals(options);
  const rejected = options.filter((o) => !o.worthwhile);

  // 조율 후 상태는 **실제로 매칭을 다시 돌려서** 구한다.
  // 톤수를 더하기만 하면 정원을 넘거나(적재율 106%) 그리디가 다른 화물을 밀어내는 걸
  // 놓쳐서, 미리보기와 수락 후 결과가 달라진다.
  const after = proposals.length
    ? accept(
        seed,
        input,
        proposals.map((p) => p.shipmentId),
        now,
      ).result
    : null;

  const feasible = after !== null && after.shortfallTon <= 0;

  return {
    before,
    after: after
      ? {
          totalTon: after.totalTon,
          loadRate: after.loadFactor,
          shortfallTon: after.shortfallTon,
        }
      : null,
    rejected,
    proposals,
    feasible,
    message: !proposals.length
      ? "제안 가능한 조율안이 없습니다. 다음 공차 일정을 확인하세요."
      : feasible
        ? `조율안 ${proposals.length}건으로 편성이 성립합니다. ${current.totalTon}톤 → ${after!.totalTon}톤 (적재율 ${Math.round(after!.loadFactor * 100)}%)`
        : `조율안 ${proposals.length}건을 찾았으나 정원을 채우지 못합니다. ${current.totalTon}톤 → ${after!.totalTon}톤, ${after!.shortfallTon}톤 부족`,
  };
}

/** 화주가 수락한 조율안을 반영해 편성을 다시 짠다. */
export function accept(
  seed: SeedData,
  input: ShipmentInput | null,
  acceptedShipmentIds: string[],
  now: Date = new Date(),
): { result: MatchResult; calc: CalcResult | null } {
  const patched: SeedData = {
    ...seed,
    shipments: seed.shipments.map((s) =>
      acceptedShipmentIds.includes(s.id) ? { ...s, status: "requested" as const } : s,
    ),
  };
  const result = match(patched, input, now);
  return { result, calc: result.calc };
}
