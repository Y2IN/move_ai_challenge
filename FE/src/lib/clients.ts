/**
 * 코레일 화주 · 영업 클라이언트 (`/api/korail/clients`).
 *
 * 이행률·상태·재계약 D-day 는 **서버가 계산해서 보냅니다.** 화면에서 다시 계산하면
 * 같은 규칙이 두 군데 생기고, 한쪽만 고치는 순간 갈라집니다.
 */

import type { ClientRow, ClientStat, ClientStatus, ClientsResponse } from '@railhub/be/clients';
import { getJson } from './api';

export type { ClientRow, ClientStat, ClientStatus, ClientsResponse };

export function fetchClients(): Promise<ClientsResponse> {
  return getJson<ClientsResponse>('/api/korail/clients');
}

export const STATUS_STYLE: Record<ClientStatus, string> = {
  정상: 'bg-[#EAF8F1] text-[#12A87A]',
  '미달 위험': 'bg-[#FFF4E0] text-[#C77700]',
  신규: 'bg-[#E8F3FF] text-[#1B64DA]',
};

/** 재계약 임박 순. 서버가 준 D-day 를 그대로 씁니다. */
export function renewalOrder(items: ClientRow[]): ClientRow[] {
  return items
    .filter((i) => i.renewalInDays >= 0)
    .slice()
    .sort((a, b) => a.renewalInDays - b.renewalInDays);
}
