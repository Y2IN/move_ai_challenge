/**
 * 코레일 공차 현황(#18) 클라이언트.
 *
 * ⚠️ 라우트가 **POST** 입니다 — 대상 화물이 있으면 화차별 견적까지 같이 계산하기
 *    때문입니다. 화물 없이 부르면 `quote: null` 이고 공차 현황만 옵니다.
 */

import type { WagonPhase } from '@railhub/be/matching';
import type { EmptyWagon, ShipmentInput, WagonType } from '@railhub/be/types';
import { getJson, postJson } from './api';

export type { WagonPhase, WagonType };

export interface Vacancy {
  /** 마감 기준 상태. `negotiate` 면 정원 미달이라 조율 대상입니다. */
  phase: WagonPhase;
  /** 마감까지 남은 시간. 음수면 이미 마감 */
  hoursToCutoff: number;
  wagon: Pick<
    EmptyWagon,
    | 'id'
    | 'label'
    | 'wagonType'
    | 'capacityTon'
    | 'reservedTon'
    | 'departure'
    | 'arrival'
    | 'cutoffAt'
    | 'minLoadRate'
    | 'emptyReason'
  >;
  route: string | null;
  /** 대상 화물을 함께 보냈을 때만 채워집니다 */
  quote: unknown | null;
}

export function fetchVacancies(shipment: ShipmentInput | null = null): Promise<{ vacancies: Vacancy[] }> {
  return postJson<{ vacancies: Vacancy[] }>('/api/wagons/vacancies', shipment ? { shipment } : {});
}

/**
 * 화차 종류 라벨.
 *
 * 서버 마스터(`GET /api/master/wagon-types`)와 **같은 값**이어야 합니다. 화면이
 * 즉시 그려야 하는 라벨이라 상수로 두되, 종류가 늘었는데 여기만 낡는 일이
 * 없도록 `syncWagonTypeLabels()` 가 마스터를 받아 덮어씁니다.
 */
export const WAGON_TYPE_LABEL: Record<WagonType, string> = {
  covered: '유개화차',
  open: '무개화차',
  container: '컨테이너화차',
  tank: '탱크화차',
};

export interface WagonTypeOption {
  code: WagonType;
  label: string;
}

/** 화차 종류 마스터. 서버가 아는 종류가 곧 정답입니다. */
export function fetchWagonTypes(): Promise<{ items: WagonTypeOption[]; count: number }> {
  return getJson<{ items: WagonTypeOption[]; count: number }>('/api/master/wagon-types');
}

/**
 * 마스터를 받아 라벨 상수를 맞춥니다. 화면 진입 때 한 번 부르면 되고,
 * 실패하면 조용히 넘어갑니다 — 기본 라벨로도 화면은 정상입니다.
 */
export async function syncWagonTypeLabels(): Promise<void> {
  try {
    const { items } = await fetchWagonTypes();
    for (const t of items) WAGON_TYPE_LABEL[t.code] = t.label;
  } catch {
    // 마스터를 못 받아도 기본 라벨이 있으므로 화면은 그대로 동작합니다.
  }
}
