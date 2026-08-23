/**
 * 전환교통 협약 정산 클라이언트 (`/api/settlement`).
 *
 * 보조금 재산정(min(A, B))은 서버가 신청서(#31)·편익(#27)과 **같은 함수**로
 * 계산합니다. 화면에서 다시 곱하지 마세요 — 세 화면의 금액이 갈라집니다.
 */

import type {
  AchievementView,
  ContractPerformance,
  DocumentView,
  RecalcView,
  SettlementResponse,
  TripRow,
} from '@railhub/be/settlement';
import { getJson, postJson } from './api';

export type {
  AchievementView,
  ContractPerformance,
  DocumentView,
  RecalcView,
  SettlementResponse,
  TripRow,
};

export function fetchSettlement(contractNo?: string | null): Promise<SettlementResponse> {
  const q = contractNo ? `?contractNo=${encodeURIComponent(contractNo)}` : '';
  return getJson<SettlementResponse>(`/api/settlement${q}`);
}

/** 정산 보고서 파일 주소 — 인쇄용 HTML 은 새 탭에서 바로 인쇄 대화상자를 띄웁니다. */
export function settlementReportUrl(contractNo: string, format: 'pdf' | 'csv' | 'xlsx' = 'pdf'): string {
  const print = format === 'pdf' ? '&autoprint=1' : '';
  return `/api/settlement/report?format=${format}&contractNo=${encodeURIComponent(contractNo)}${print}`;
}

/**
 * 증빙 서류 제출. **파일 본문은 보내지 않습니다** — 서버가 파일명·시각만 기록해
 * 제출 상태를 채웁니다 (시연 범위).
 */
export function uploadSettlementDocument(
  key: string,
  fileName: string,
): Promise<{ upload: { key: string; name: string; uploadedAt: string }; note: string }> {
  return postJson(`/api/settlement/documents/${encodeURIComponent(key)}`, { fileName });
}

/** 실적이 기간 경과보다 뒤처졌는지. 배너를 띄울지 정하는 기준입니다. */
export const isBehind = (a: AchievementView) => a.gapRate < 0;

/** "6개월 중 약 4.4개월 경과" — 협약 기간이 얼마나 지났는지 한 줄 */
export function elapsedLabel(a: AchievementView): string {
  const months = (d: number) => Math.round((d / 30.44) * 10) / 10;
  return `${months(a.totalDays)}개월 중 약 ${months(a.elapsedDays)}개월 경과 · 협약 전체 기준`;
}

/** 남은 기간을 주 단위로. 0이면 "기간 종료" */
export function remainLabel(a: AchievementView): string {
  if (a.remainDays <= 0) return '협약 기간 종료';
  return `${Math.max(1, Math.round(a.remainDays / 7))}주`;
}
