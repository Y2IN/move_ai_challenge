'use client';

import { useCallback } from 'react';
import { formatNumber } from './format';
import { fetchPublicStats, type PublicStats } from './public';
import { useAsync, type AsyncState } from './use-async';

/**
 * 랜딩·로그인 화면이 함께 쓰는 공개 수치(#6) 훅.
 *
 * 두 화면 모두 로그인 전이라 같은 엔드포인트를 보고, 라우트가 60초 캐시를 붙여
 * 응답하므로 화면마다 부르더라도 네트워크는 한 번입니다.
 *
 * **실패해도 대체 수치를 지어내지 않습니다.** 랜딩의 "3억 4,200만"은 홈·신청서와
 * 같은 집계에서 나온 값이고, 못 불러왔을 때 옛날 상수를 대신 띄우면 화면끼리
 * 숫자가 어긋납니다. 값 자리를 비우고 그 사실을 적는 쪽이 낫습니다.
 */
export function usePublicStats(): AsyncState<PublicStats> {
  return useAsync<PublicStats>(useCallback(() => fetchPublicStats(), [])).state;
}

/** 누적 실적 두 줄 — 랜딩 하단과 로그인 좌측 패널이 같은 문구를 씁니다. */
export function cumulativeLines(stats: PublicStats): { label: string; value: string }[] {
  return [
    { label: '누적 합적 화주', value: `${formatNumber(stats.cumulative.shippers)}개사` },
    { label: '채운 공차', value: `${formatNumber(stats.cumulative.filledWagons)}량` },
  ];
}
