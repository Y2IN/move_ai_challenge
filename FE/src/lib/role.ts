import type { Role } from '../mocks/marketing';

/** 로그인 시 고른 역할을 세션에 저장해 leftbar·홈이 공유한다. ponytail: 컨텍스트 없이 sessionStorage 한 키 */
const KEY = 'railhub-role';

export function getRole(): Role {
  if (typeof window === 'undefined') return 'corp';
  return (window.sessionStorage.getItem(KEY) as Role | null) ?? 'corp';
}

export function setRole(role: Role): void {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(KEY, role);
}
