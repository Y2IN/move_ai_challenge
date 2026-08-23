/**
 * 조율 에이전트 API(#22 실행 · #23 진행 SSE · #25 조회 · #26 취소) +
 * 편성 확정(#19) · 편익 재계산(#27) 클라이언트.
 *
 * **양보 대가가 절감액보다 큰 화주를 거르는 판단은 서버가 합니다.** 화면은
 * `rejected` 에 담겨 온 사유를 표시만 하고, 여기서 다시 계산하지 않습니다.
 */

import type { CalcResult, ItemCategory, ShipmentInput, WagonType } from '@railhub/be/types';
import type { MatchResult } from '@railhub/be/matching';
import type { ConcessionOption, NegotiationResult, Proposal } from '@railhub/be/negotiate';
// Confirmation 은 아래에서 화면이 쓰는 필드만 좁혀 다시 정의한다 (BE 것은 EmptyWagon
// 전체를 물고 있어 클라이언트가 알 필요 없는 필드까지 딸려 온다).
import type { StoredNegotiation } from '@railhub/be/store';
import { getJson, postJson } from './api';

export type { ConcessionOption, NegotiationResult, Proposal, StoredNegotiation };

// ── #22 실행 ───────────────────────────────────────────────────

export interface NegotiationRun extends NegotiationResult {
  /** NEG-NNN — #23 스트림·#25 조회가 쓰는 세션 id */
  id: string;
}

/** LLM 을 타므로 수 초 걸립니다. 화면은 이 호출을 **한 번만** 해야 합니다. */
export function runNegotiation(
  shipment: ShipmentInput | null,
  registeredId?: string | null,
): Promise<NegotiationRun> {
  return postJson<NegotiationRun>('/api/negotiation/run', {
    ...(shipment ? { shipment } : {}),
    ...(registeredId ? { registeredId } : {}),
  });
}

/** #25 GET /api/negotiation/{id} — 재진입 시 LLM 재호출 없이 결과만 가져옵니다. */
export function fetchNegotiation(id: string): Promise<StoredNegotiation> {
  return getJson<StoredNegotiation>(`/api/negotiation/${encodeURIComponent(id)}`);
}

export interface CancelResponse {
  id: string;
  status: string;
  message: string;
  nextWagon: { id: string; label: string; departAt: string } | null;
}

/** #26 "다음 공차 일정 대기" — 다음 출발 공차를 함께 안내합니다. */
export function cancelNegotiation(id: string): Promise<CancelResponse> {
  return postJson<CancelResponse>(`/api/negotiation/${encodeURIComponent(id)}/cancel`);
}

// ── #23 진행 스트림 (SSE) ──────────────────────────────────────

export interface StreamStart {
  negotiationId: string;
  feasible: boolean;
  loadRate: number;
}

export interface StreamProposal {
  step: number;
  shipper: string;
  lever?: string;
  ask?: string;
  conflict?: string;
  narrative?: string;
  savingKrw?: number;
  status: 'CONDITIONAL' | 'ACCEPTED';
}

export interface StreamLoadRate {
  from: number;
  to: number;
  step: number;
}

export interface StreamDone {
  finalLoadRate: number;
  feasible: boolean;
  message: string;
}

export interface NegotiationStreamHandlers {
  onStart?: (e: StreamStart) => void;
  onProposal?: (e: StreamProposal) => void;
  onLoadRate?: (e: StreamLoadRate) => void;
  onDone?: (e: StreamDone) => void;
  onError?: (message: string) => void;
}

/**
 * 적재율 41% → 75% → 94% 애니메이션의 원천.
 *
 * 저장된 세션을 재생하는 것이라 LLM 도 재계산도 타지 않습니다. 반환값은 구독
 * 해제 함수이므로 **useEffect 의 cleanup 에서 반드시 부르세요** — 안 그러면
 * 화면을 떠난 뒤에도 연결이 남아 다음 진입에서 이벤트가 겹칩니다.
 */
export function openNegotiationStream(
  id: string,
  handlers: NegotiationStreamHandlers,
): () => void {
  const source = new EventSource(`/api/negotiation/${encodeURIComponent(id)}/stream`);

  const on = <T>(event: string, handler?: (e: T) => void) => {
    if (!handler) return;
    source.addEventListener(event, (ev) => {
      try {
        handler(JSON.parse((ev as MessageEvent).data) as T);
      } catch {
        // 이벤트 하나가 깨져도 스트림 전체를 죽이지 않습니다.
      }
    });
  };

  on<StreamStart>('start', handlers.onStart);
  on<StreamProposal>('proposal', handlers.onProposal);
  on<StreamLoadRate>('loadRate', handlers.onLoadRate);
  on<StreamDone>('done', (e) => {
    handlers.onDone?.(e);
    source.close(); // done 이후 서버가 닫으므로 재연결 시도를 막습니다
  });

  // SSE 는 연결이 끊겨도 브라우저가 자동 재연결합니다. done 을 받기 전에 끊긴 것만
  // 실패로 보고 닫습니다.
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) {
      handlers.onError?.('진행 상황 연결이 끊겼습니다.');
    }
  };

  return () => source.close();
}

// ── #19 편성 확정 · #27 편익 ───────────────────────────────────

export interface Confirmation {
  /** GRP-NNN — 확정할 때 발급됩니다 */
  groupId: string;
  status: 'confirmed';
  wagon: {
    id: string;
    label: string;
    wagonType: WagonType;
    capacityTon: number;
    departure: { date: string; time: string };
  };
  members: {
    shipmentId: string;
    shipperName: string;
    weightTon: number;
    category: ItemCategory;
    /** 조율(양보)이 있어야 실린 화물이면 그 이유 */
    requiresNegotiation: string | null;
  }[];
  totalTon: number;
  capacityTon: number;
  loadFactor: number;
  confirmedAt: string;
  calc: CalcResult | null;
}

/**
 * #19 POST /api/matching/confirm — `acceptedShipmentIds` 를 주면 조율 수락분을
 * 편성에 끌어와 재매칭한 뒤 확정합니다. 성립하지 않으면 409 입니다.
 */
export function confirmMatching(
  shipment: ShipmentInput | null,
  acceptedShipmentIds: string[],
  opts: { registeredId?: string | null; clientKey?: string | null } = {},
): Promise<{ confirmation: Confirmation }> {
  return postJson('/api/matching/confirm', {
    ...(shipment ? { input: shipment } : {}),
    acceptedShipmentIds,
    ...(opts.registeredId ? { registeredId: opts.registeredId } : {}),
    // 같은 키로 다시 보내면 서버가 기존 편성을 돌려준다 (편성 중복 발급 방지)
    ...(opts.clientKey ? { clientKey: opts.clientKey } : {}),
  });
}

/** 확정 편성 조회 — 화면 재진입·새로고침 때 쓰기 없이 같은 편성을 다시 그린다. */
export function fetchConfirmation(groupId: string): Promise<{ confirmation: Confirmation }> {
  return getJson(`/api/matching/confirmations/${encodeURIComponent(groupId)}`);
}

/** 가장 최근 확정 편성. 세션에 번호가 없을 때의 폴백. */
export function fetchLatestConfirmation(): Promise<{
  exists: boolean;
  confirmation: Confirmation | null;
}> {
  return getJson('/api/matching/confirmations/latest');
}

export interface BenefitCalcResponse {
  status: MatchResult['status'];
  totalTon: number;
  capacityTon: number;
  loadFactor: number;
  calc: CalcResult | null;
}

/** #27 POST /api/benefits/calculate — 도로 단독 vs 철도 합적 비교값 */
export function calculateBenefits(
  shipment: ShipmentInput | null,
  acceptedShipmentIds: string[] = [],
  registeredId?: string | null,
): Promise<BenefitCalcResponse> {
  return postJson('/api/benefits/calculate', {
    ...(shipment ? { shipment } : {}),
    acceptedShipmentIds,
    ...(registeredId ? { registeredId } : {}),
  });
}
