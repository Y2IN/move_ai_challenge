/**
 * K-ESG 리포트 API(#40~#42) 클라이언트.
 *
 * 화면은 이 파일만 알면 됩니다 — 엔드포인트 경로·쿼리 규칙·에러 모양이 바뀌면
 * 여기 한 곳만 고칩니다. 타입은 BE 소스(@railhub/be)에서 **type-only** 로 가져와
 * 클라이언트 번들에 BE 코드가 딸려 오지 않습니다.
 */

import type {
  BenefitBreakdownItem,
  EsgGenerationInfo,
  EsgPeriod,
  EsgReport,
  EsgSection,
  EsgSectionKey,
  KesgIndicator,
} from '@railhub/be/esg/types';

export type {
  BenefitBreakdownItem,
  EsgGenerationInfo,
  EsgPeriod,
  EsgReport,
  EsgSection,
  EsgSectionKey,
  KesgIndicator,
};

/** 리포트(#41)가 오기 전 범례에 쓸 고정 문구. BE narrative.DISCLAIMER 와 같은 문장입니다. */
export const ESG_DISCLAIMER =
  '수치는 법정 산식과 고정 계수로 계산되며, AI는 서술 문장만 작성합니다.';

// ── 조회 조건 ──────────────────────────────────────────────────

/** #40·#41·#42 공통 조회 조건. 전부 생략하면 "직전 완료 분기 · 전체 화주"입니다. */
export interface EsgQuery {
  /** "2026Q2" · "2026-05" · "2026" */
  period?: string;
  from?: string;
  to?: string;
  shipperId?: string;
}

/** 응답에 실려 온 기간을 다음 요청(재생성·내보내기)에 그대로 고정하기 위한 변환 */
export function periodToQuery(period: EsgPeriod): EsgQuery {
  return period.id === 'custom'
    ? { from: period.from, to: period.to }
    : { period: period.id };
}

function toParams(query: EsgQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ['period', 'from', 'to', 'shipperId'] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return params;
}

function toSearch(query: EsgQuery): string {
  const s = toParams(query).toString();
  return s ? `?${s}` : '';
}

// ── 에러 ───────────────────────────────────────────────────────

export class EsgApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function throwFrom(res: Response): Promise<never> {
  let message = `요청이 실패했습니다 (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // JSON 이 아니면 상태 코드 문구를 그대로 씁니다.
  }
  throw new EsgApiError(message, res.status);
}

// ── #40 지표표 ─────────────────────────────────────────────────

/** 라우트가 이 타입으로 응답을 조립합니다. 필드를 바꾸면 라우트도 같이 바꿔야 합니다. */
export interface EsgSummary {
  tripCount: number;
  legCount: number;
  shipperCount: number;
  totalTon: number;
  avgLoadRate: number;
  baselineCo2Ton: number;
  actualCo2Ton: number;
  reducedCo2Ton: number;
  reductionRate: number;
  totalBenefitKrw: number;
  benefitItems: BenefitBreakdownItem[];
  pineTrees: number;
  truckLoadsAvoided: number;
}

export interface EsgIndicatorsResponse {
  period: EsgPeriod;
  shipperId: string | null;
  shipperName: string | null;
  indicators: KesgIndicator[];
  summary: EsgSummary;
  coefficientVersion: string;
  verified: boolean;
}

/** GET /api/esg/indicators — LLM 미사용이라 빠릅니다. 화면 뼈대는 이걸로 먼저 그립니다. */
export async function fetchEsgIndicators(query: EsgQuery = {}): Promise<EsgIndicatorsResponse> {
  const res = await fetch(`/api/esg/indicators${toSearch(query)}`, { cache: 'no-store' });
  if (!res.ok) await throwFrom(res);
  return (await res.json()) as EsgIndicatorsResponse;
}

// ── #41 리포트 문단 ────────────────────────────────────────────

export interface GenerateReportBody extends EsgQuery {
  /** 일부 문단만 재생성 (↻). 생략하면 전체 생성 */
  sections?: EsgSectionKey[];
  /** 재생성 시 유지할 기존 문단 — 서버가 출처를 `user` 로 내려 되돌려줍니다 */
  previous?: EsgSection[];
}

/**
 * POST /api/esg/report — LLM 호출이라 수 초~수십 초 걸립니다.
 * 인증이 없거나 호출이 실패해도 200 이고, 문단에 `source: "fallback"` 배지가 붙습니다.
 */
export async function generateEsgReport(body: GenerateReportBody = {}): Promise<EsgReport> {
  const res = await fetch('/api/esg/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwFrom(res);
  return (await res.json()) as EsgReport;
}

// ── #42 Scope 3 내보내기 ───────────────────────────────────────

export type Scope3Format = 'csv' | 'xlsx' | 'pdf';

/**
 * csv·xlsx 는 attachment 로 내려오므로 `location.href` 이동으로 받고,
 * pdf 는 인쇄용 HTML 이므로 새 탭(window.open)으로 열어야 합니다.
 */
export function scope3ExportUrl(format: Scope3Format, query: EsgQuery = {}): string {
  const params = toParams(query);
  params.set('format', format);
  if (format === 'pdf') params.set('autoprint', '1');
  return `/api/esg/scope3/export?${params.toString()}`;
}
