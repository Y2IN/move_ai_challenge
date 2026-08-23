/**
 * 홈 대시보드 API(#7·#8·#9) 클라이언트 + 화면 표기 변환.
 *
 * 타입은 BE 소스에서 **type-only** 로 가져옵니다 — 응답 스키마가 바뀌면
 * 여기서 타입체크가 깨지므로 화면이 조용히 빈칸을 그리는 일이 없습니다.
 */

import type {
  DashboardResponse,
  KpiCard,
  MatchRow,
  MatchRowStatus,
  MatchSummary,
  Persona,
} from '@railhub/be/types';
import { getJson, postJson } from './api';
import { formatCo2, formatDateTime, formatKrw, formatNumber } from './format';

export type { DashboardResponse, KpiCard, MatchRow, MatchSummary, Persona };

// ── 조회 ───────────────────────────────────────────────────────

/** #7 GET /api/dashboard — persona 별 KPI 라벨·값을 **서버가** 담아 보냅니다. */
export function fetchDashboard(persona: Persona): Promise<DashboardResponse> {
  return getJson<DashboardResponse>(`/api/dashboard?persona=${persona}`);
}

export interface MatchesResponse {
  items: MatchSummary[];
  count: number;
  page: number;
  pageSize: number;
  total: number;
}

/** #8 GET /api/matches — 요약만 옵니다. 상세는 행을 펼칠 때 #9 로 따로 받습니다. */
export function fetchMatches(pageSize = 20): Promise<MatchesResponse> {
  return getJson<MatchesResponse>(`/api/matches?pageSize=${pageSize}`);
}

/** #9 GET /api/matches/{id} — 행 펼침 상세 (lazy) */
/**
 * #43 화차 배정 승인 (코레일 담당자).
 *
 * 화주의 "확정"과 코레일의 "승인"은 다른 사건입니다 — 확정은 화주가 이 편성으로
 * 가겠다는 의사, 승인은 코레일이 그 화차를 실제로 내주겠다는 배차 결정입니다.
 * 연타해도 같은 결과입니다 (서버가 멱등 처리).
 */
export function approveAssignment(
  groupId: string,
): Promise<{ confirmation: { groupId: string; status: 'confirmed' | 'approved'; approvedAt: string | null }; alreadyApproved: boolean }> {
  return postJson(`/api/korail/assignments/${encodeURIComponent(groupId)}/approve`, {});
}

export function fetchMatch(id: string): Promise<MatchRow> {
  return getJson<MatchRow>(`/api/matches/${encodeURIComponent(id)}`);
}

// ── 화면 표기 변환 ─────────────────────────────────────────────

export type MatchTone = MatchRowStatus;

export const TONE_LABEL: Record<MatchTone, string> = {
  done: '매칭 완료',
  group: '그룹핑 중',
  wait: '공차 대기',
};

export interface StatData {
  label: string;
  value: string;
  delta: string;
  /** 'up' 초록 · 'flat' 회색 */
  deltaTone: 'up' | 'flat';
}

/**
 * 값이 **내려가는 게 개선**인 KPI. 공차율이 9% 떨어진 걸 회색 "−9%" 로 그리면
 * 코레일 담당자 화면에서 성과가 악화로 읽힙니다.
 */
const LOWER_IS_BETTER = new Set(['emptyWagonRate']);

/** KpiCard(#7) → 상단 카드 4장. 라벨·값은 서버 것을 그대로 쓰고 증감 문구만 만듭니다. */
export function toStatCards(kpis: KpiCard[]): StatData[] {
  return kpis.map((k) => {
    const delta = k.deltaPct;
    if (delta == null) return { label: k.label, value: k.value, delta: '이번 분기', deltaTone: 'flat' };

    const improved = LOWER_IS_BETTER.has(k.key) ? delta < 0 : delta > 0;
    const abs = Math.abs(delta);
    return {
      label: k.label,
      value: k.value,
      delta: improved ? `전 분기 대비 ${abs}% 개선` : `전 분기 대비 ${delta > 0 ? '+' : '−'}${abs}%`,
      deltaTone: improved ? 'up' : 'flat',
    };
  });
}

export interface MatchDetail {
  k: string;
  v: string;
}

export interface MatchRowData {
  id: string;
  route: string;
  wagon: string;
  sub: string;
  tons: string;
  /** 적재율 (%) */
  load: number;
  /** 운송비 표시값. 기업 뷰는 절감률, 코레일 뷰는 추가 수익 */
  saving: string;
  tone: MatchTone;
  /** 출발 예정 시각 — 목록(#8)에 함께 옵니다 (펼치기 전에도 열이 채워집니다) */
  departAt: string;
  /** 코레일 배차 승인 상태 (#43). 시연용 예시 행은 undefined — 승인 대상이 아닙니다 */
  approval?: { status: 'confirmed' | 'approved'; approvedAt: string | null };
  /** #9 로 받아 온 상세. 아직 안 받았으면 null (펼칠 때 채웁니다) */
  detail: MatchDetail[] | null;
}

/**
 * MatchSummary(#8) → 목록 행.
 *
 * 같은 편성이라도 **기업은 자기가 얼마 아꼈는지**, 코레일은 **화차를 팔아 얼마를
 * 더 벌었는지**를 봅니다. 값이 아니라 관점이 다른 것이라 persona 로 갈라 표기합니다.
 */
export function toMatchRowData(m: MatchSummary, persona: Persona): MatchRowData {
  return {
    id: m.id,
    route: m.route,
    wagon: m.wagon,
    sub: m.sub,
    tons: `${formatNumber(m.tons, 1)}t`,
    load: Math.round(m.loadRate * 100),
    saving: persona === 'corp' ? `-${m.savingPct}%` : `+${formatKrw(m.savingKrw)}`,
    tone: m.status,
    departAt: m.departAt,
    approval: m.approval,
    detail: null,
  };
}

/** MatchRowDetail(#9) → 펼침 4칸 */
export function toMatchDetail(m: MatchRow): MatchDetail[] {
  const d = m.detail;
  return [
    { k: '합적 파트너', v: d.partners.length ? d.partners.join(' · ') : '단독' },
    { k: '출발', v: formatDateTime(d.departAt) },
    { k: '탄소 감축', v: formatCo2(d.co2ReducedTon) },
    { k: '환산 가치', v: formatKrw(d.equivalentKrw) },
  ];
}
