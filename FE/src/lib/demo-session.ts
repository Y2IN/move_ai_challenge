'use client';

/**
 * 화면 사이로 넘기는 시연 상태 — 등록한 화물 · 조율 세션 id.
 *
 * 04a 등록 → 04c 미성립 → 04d 조율 → 04e 확정이 **같은 화물 한 건**을 따라갑니다.
 * BE 는 인증이 없어 "내 화물"을 서버에서 되찾을 방법이 없으므로, 방금 등록한
 * 입력을 브라우저가 들고 다니며 각 단계에서 다시 실어 보냅니다.
 *
 * sessionStorage 인 이유: 탭을 닫으면 시연도 끝납니다. localStorage 에 남기면
 * 다음 시연에서 지난 화물이 살아 돌아와 수치가 어긋납니다.
 */

import type { ShipmentInput } from '@railhub/be/types';

const SHIPMENT_KEY = 'railhub-shipment';
const NEGOTIATION_KEY = 'railhub-negotiation-id';
const REGISTERED_KEY = 'railhub-registered-id';
const CONFIRMATION_KEY = 'railhub-confirmation-id';

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 형식이 깨졌으면 없는 것으로 칩니다 — 시드 단독 시나리오로 이어집니다.
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

/** 04a 에서 등록한 화물. 없으면 null — 이때는 시드 단독(시연 실패 시나리오)입니다. */
export const getShipment = () => read<ShipmentInput>(SHIPMENT_KEY);
export const setShipment = (input: ShipmentInput) => write(SHIPMENT_KEY, input);

/** 04d 가 발급받은 NEG-NNN. 04e 가 수락분을 반영해 확정할 때 씁니다. */
export const getNegotiationId = () => read<string>(NEGOTIATION_KEY);
export const setNegotiationId = (id: string) => write(NEGOTIATION_KEY, id);

/**
 * 04a 에서 서버가 발급한 SHM-USER-NNN.
 *
 * 등록 화물은 이제 매칭 풀에 들어갑니다. 같은 건이 "풀에 있는 화물"과
 * "지금 입력"으로 두 번 세이지 않도록, 이 id 를 매칭 요청에 함께 보내
 * 서버가 풀에서 빼도록 합니다.
 */
export const getRegisteredId = () => read<string>(REGISTERED_KEY);
export const setRegisteredId = (id: string) => write(REGISTERED_KEY, id);

/** 확정된 편성 번호(GRP-NNN). 04e 는 이 번호로 **조회만** 합니다. */
export const getConfirmationId = () => read<string>(CONFIRMATION_KEY);
export const setConfirmationId = (id: string) => write(CONFIRMATION_KEY, id);

export function clearDemoSession(): void {
  if (typeof window === 'undefined') return;
  for (const key of [SHIPMENT_KEY, NEGOTIATION_KEY, REGISTERED_KEY, CONFIRMATION_KEY]) {
    window.sessionStorage.removeItem(key);
  }
}
