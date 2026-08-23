'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 조회 상태 3종. 화면은 이 셋만 그리면 됩니다.
 *
 * `error` 는 메시지를 들고 있습니다 — BE 가 준 한국어 문장을 그대로 보여주기 위한
 * 것이라, 화면에서 "불러오지 못했습니다" 같은 문구로 덮어쓰지 마세요.
 */
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export interface AsyncHandle<T> {
  state: AsyncState<T>;
  /** 다시 시도 버튼이 부르는 것. 로딩부터 다시 시작합니다. */
  reload: () => void;
  /** 응답을 받은 뒤 화면에서 일부만 갈아 끼울 때 (예: 행 상세 lazy 로딩) */
  patch: (update: (prev: T) => T) => void;
}

/**
 * 마운트 시 한 번 불러오고, 실패하면 메시지를 들고 있는 훅.
 *
 * `load` 는 매 렌더 새 함수가 되기 쉬우므로 **호출부에서 useCallback 으로 감싸세요.**
 * 그렇지 않으면 매 렌더마다 다시 부릅니다.
 *
 * `once` 는 dev StrictMode 의 이펙트 2회 실행을 막습니다. LLM 을 타는 호출
 * (조율 실행·문단 생성)은 두 번 부르면 값을 두 번 지불하므로 반드시 켜세요.
 */
export function useAsync<T>(load: () => Promise<T>, once = false): AsyncHandle<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  // 언마운트 후 setState 로 경고가 나지 않도록. 화면 전환이 잦은 시연에서 실제로 납니다.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(() => {
    setState({ status: 'loading' });
    load()
      .then((data) => alive.current && setState({ status: 'ready', data }))
      .catch((error: Error) => alive.current && setState({ status: 'error', message: error.message }));
  }, [load]);

  /**
   * `once` 는 **같은 load 함수의 중복 실행**만 막습니다 (dev StrictMode 의 2회 실행).
   *
   * 예전에는 boolean 래치라서 최초 1회 이후 load 가 바뀌어도 영영 다시 안 돌았습니다 —
   * 조율 화면의 "조율 다시 실행" 버튼이 아무 동작도 안 하던 원인입니다.
   */
  const startedFor = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (once && startedFor.current === run) return;
    startedFor.current = run;
    run();
  }, [run, once]);

  const patch = useCallback((update: (prev: T) => T) => {
    setState((prev) => (prev.status === 'ready' ? { status: 'ready', data: update(prev.data) } : prev));
  }, []);

  return { state, reload: run, patch };
}
