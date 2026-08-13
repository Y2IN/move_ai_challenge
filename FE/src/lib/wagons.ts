/**
 * 코레일 공차 현황(#18) 클라이언트.
 *
 * ⚠️ 라우트가 **POST** 입니다 — 대상 화물이 있으면 화차별 견적까지 같이 계산하기
 *    때문입니다. 화물 없이 부르면 `quote: null` 이고 공차 현황만 옵니다.
 */

import type { WagonPhase } from '@railhub/be/matching';
import type { EmptyWagon, ShipmentInput, WagonType } from '@railhub/be/types';
import { postJson } from './api';

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

export const WAGON_TYPE_LABEL: Record<WagonType, string> = {
  covered: '유개화차',
  open: '무개화차',
  container: '컨테이너화차',
  tank: '탱크화차',
};
