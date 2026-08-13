'use client';

/**
 * 로그인 계정(#4 `/api/me`) 클라이언트.
 *
 * 인증(#1~#5)이 MVP 밖이라 세션은 없지만, 회사명·담당자를 화면에 상수로 박아
 * 두지는 않습니다 — 인증이 붙는 날 그 상수를 찾아 지우는 일부터 하게 됩니다.
 * 지금은 화면이 고른 역할을 서버로 보내고 서버가 표시값을 돌려줍니다.
 */

import { useCallback } from 'react';
import type { Account, Persona } from '@railhub/be/types';
import { getJson } from './api';
import { useAsync } from './use-async';

export type { Account };

export interface MeResponse {
  account: Account;
  /** 지금은 항상 false — 세션이 없다는 사실을 응답이 스스로 말합니다 */
  authenticated: boolean;
}

export function fetchAccount(persona: Persona): Promise<Account> {
  return getJson<MeResponse>(`/api/me?persona=${persona}`).then((r) => r.account);
}

/** 값이 오기 전에는 null. 화면은 그 동안 자리만 지킵니다. */
export function useAccount(persona: Persona): Account | null {
  const { state } = useAsync<Account>(useCallback(() => fetchAccount(persona), [persona]));
  return state.status === 'ready' ? state.data : null;
}
