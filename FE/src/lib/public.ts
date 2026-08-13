/**
 * 랜딩 히어로 수치(#6) 클라이언트.
 *
 * 로그인 전 화면이라 인증이 없고, 라우트가 60초 캐시를 붙여 응답합니다.
 * 값은 대시보드(#7)와 **같은 집계에서 나옵니다** — 랜딩의 "3억 4,200만"과
 * 홈의 보조금 예상액이 어긋나면 안 되기 때문입니다.
 */

import type { PublicStats } from '@railhub/be/types';
import { getJson } from './api';

export type { PublicStats };

export function fetchPublicStats(): Promise<PublicStats> {
  // 라우트가 s-maxage 로 캐시하므로 클라이언트는 기본 캐시 정책을 그대로 씁니다.
  return getJson<PublicStats>('/api/public/stats', { cache: 'default' });
}
