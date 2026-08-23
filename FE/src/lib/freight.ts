/**
 * 화물 등록 API(#10 파싱 · #11 등록 · #16 매칭 요청) 클라이언트.
 *
 * ⚠️ **출발지·도착지는 자유 입력이 아니라 역 코드입니다.** BE 는 등록되지 않은 역
 *    코드를 400 으로 막습니다(`validateShipmentInput`). 그래서 화면은 마스터
 *    (`/api/master/stations`)에서 받은 역만 고를 수 있고, 자연어 파싱 결과도
 *    그 목록에 맞춰 한 번 정규화한 뒤에야 폼에 들어갑니다.
 */

import type { ParseResponse, ParsedFreight } from '@railhub/be/parse';
import type { MatchResult } from '@railhub/be/matching';
import type {
  CompanyGrade,
  ItemCategory,
  Shipment,
  ShipmentInput,
  TransportArrangement,
} from '@railhub/be/types';
import { getJson, postJson } from './api';

export type { MatchResult, ParseResponse, ShipmentInput };

// ── 화면 표시값 ↔ 서버 enum ────────────────────────────────────

export type CorpType = '중소기업' | '우수물류기업' | '일반';
export type TransportMode = '자차' | '위탁';

export const FREIGHT_ITEMS: ItemCategory[] = ['석유화학제품', '화학원료', '철강재', '기타'];
export const CORP_TYPES: CorpType[] = ['중소기업', '우수물류기업', '일반'];
export const TRANSPORT_MODES: TransportMode[] = ['자차', '위탁'];

/**
 * 출발일 유연폭 — 화차 시각표와 희망일이 정확히 일치하는 경우는 드물다.
 * 이 값이 0이면 대부분의 등록이 "조건에 맞는 공차 없음"으로 끝난다 (서버 기본 ±2일).
 */
export type FlexChoice = '당일만' | '±1일' | '±2일' | '±3일';
export const FLEX_CHOICES: FlexChoice[] = ['당일만', '±1일', '±2일', '±3일'];
export const FLEX_TO_DAYS: Record<FlexChoice, number> = { 당일만: 0, '±1일': 1, '±2일': 2, '±3일': 3 };

export const CORP_TYPE_TO_API: Record<CorpType, CompanyGrade> = {
  중소기업: 'sme',
  우수물류기업: 'excellentLogistics',
  일반: 'general',
};

export const TRANSPORT_MODE_TO_API: Record<TransportMode, TransportArrangement> = {
  자차: 'own',
  위탁: 'consignment',
};

export interface FreightForm {
  /** 역 코드 (마스터에서 고른 값). 비어 있으면 미선택 */
  originStationId: string;
  destStationId: string;
  item: ItemCategory;
  tons: string;
  departDate: string;
  /** 출발일 앞뒤 허용 폭 — 매칭 일정 검사(scheduleFits)에 그대로 들어간다 */
  flexDays: FlexChoice;
  corpType: CorpType;
  transportMode: TransportMode;
  /** 화주가 문장으로 적은 제약 — 조율 에이전트(#22)가 읽는 입력입니다 */
  constraintText: string;
}

export type FreightField = keyof FreightForm;

export const emptyForm: FreightForm = {
  originStationId: '',
  destStationId: '',
  item: '석유화학제품',
  tons: '',
  departDate: '',
  flexDays: '±2일',
  corpType: '중소기업',
  transportMode: '위탁',
  constraintText: '',
};

// ── 마스터 (역 목록) ───────────────────────────────────────────

export interface StationOption {
  id: string;
  name: string;
  region: string;
  handling: string[];
}

export function fetchStations(): Promise<{ items: StationOption[]; count: number }> {
  return getJson<{ items: StationOption[]; count: number }>('/api/master/stations');
}

// ── #10 자연어 파싱 ────────────────────────────────────────────

/** GET /api/freights/parse — 고를 수 있는 예시 문장 (데모 케이스) */
export function fetchParseCases(): Promise<{
  demo: boolean;
  notice: string;
  cases: { id: string; label: string; text: string }[];
}> {
  return getJson('/api/freights/parse');
}

/** POST /api/freights/parse — 문장 → 구조화 필드 */
export function parseFreight(text: string): Promise<ParseResponse> {
  return postJson<ParseResponse>('/api/freights/parse', { text });
}

/**
 * 파싱이 돌려준 지명("울산 공장")을 역 코드로 맞춥니다.
 *
 * 역명과 지역명 앞 두 글자를 겹쳐 봅니다 — "울산 공장"→울산화물역,
 * "경기 물류센터"→오봉역(경기 의왕)이 이 규칙으로 붙습니다. 못 맞추면 null 이고,
 * 그 필드는 AI 배지 없이 비워 둡니다. **추측해서 채우면 안 됩니다** — 엉뚱한
 * 역으로 매칭이 돌아가면 화면은 성공한 것처럼 보이고 결과만 틀립니다.
 */
export function matchStation(label: string | null, stations: StationOption[]): string | null {
  if (!label) return null;
  const hit = stations.find(
    (s) => label.includes(s.name) || label.includes(s.name.slice(0, 2)) || label.includes(s.region.slice(0, 2)),
  );
  return hit?.id ?? null;
}

/** 파싱 결과 → 폼 값 + AI가 실제로 채운 필드 목록 */
export function applyParsed(
  fields: ParsedFreight,
  stations: StationOption[],
  base: FreightForm,
): { form: FreightForm; aiFields: FreightField[] } {
  const originStationId = matchStation(fields.origin.value, stations);
  const destStationId = matchStation(fields.destination.value, stations);
  const item = FREIGHT_ITEMS.includes(fields.item.value as ItemCategory)
    ? (fields.item.value as ItemCategory)
    : null;

  const form: FreightForm = {
    ...base,
    originStationId: originStationId ?? base.originStationId,
    destStationId: destStationId ?? base.destStationId,
    item: item ?? base.item,
    tons: fields.tons.value != null ? String(fields.tons.value) : base.tons,
    departDate: fields.departDate.value ?? base.departDate,
  };

  // 실제로 값이 들어온 필드에만 배지를 답니다.
  const aiFields: FreightField[] = [];
  if (originStationId) aiFields.push('originStationId');
  if (destStationId) aiFields.push('destStationId');
  if (item) aiFields.push('item');
  if (fields.tons.value != null) aiFields.push('tons');
  if (fields.departDate.value) aiFields.push('departDate');

  return { form, aiFields };
}

// ── 폼 → 서버 입력 ─────────────────────────────────────────────

/** 화면에서 먼저 거르는 필수값. 서버 검증(#11)과 같은 규칙이라 왕복 없이 잡힙니다. */
export function validateForm(form: FreightForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.originStationId) errors.originStationId = '출발역을 선택하세요.';
  if (!form.destStationId) errors.destStationId = '도착역을 선택하세요.';
  if (form.originStationId && form.originStationId === form.destStationId)
    errors.destStationId = '출발역과 도착역이 같습니다.';
  const tons = Number(form.tons);
  if (!Number.isFinite(tons) || tons <= 0) errors.tons = '중량(톤)은 0보다 큰 숫자여야 합니다.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.departDate)) errors.departDate = '희망 출발일을 선택하세요.';
  return errors;
}

export function toShipmentInput(form: FreightForm, shipperName?: string): ShipmentInput {
  return {
    originStationId: form.originStationId,
    destStationId: form.destStationId,
    category: form.item,
    weightTon: Number(form.tons),
    desiredDepartureDate: form.departDate,
    departureFlexDays: FLEX_TO_DAYS[form.flexDays],
    companyGrade: CORP_TYPE_TO_API[form.corpType],
    transportArrangement: TRANSPORT_MODE_TO_API[form.transportMode],
    shipperName,
    constraintText: form.constraintText || undefined,
  };
}

// ── #11 등록 · #16 매칭 요청 ───────────────────────────────────

export interface RegisterResponse {
  shipment: Shipment;
  matchPreview: {
    status: MatchResult['status'];
    wagonLabel: string | null;
    totalTon: number;
    capacityTon: number;
    loadFactor: number;
    shortfallTon: number;
    message: string;
  };
}

/** POST /api/freights — 등록. 응답에 편성 미리보기가 함께 옵니다. */
export function registerFreight(input: ShipmentInput): Promise<RegisterResponse> {
  return postJson<RegisterResponse>('/api/freights', input);
}

/**
 * #16 POST /api/matching/request — 매칭 풀(시드 + 등록 화물) + 방금 등록한 화물로 편성.
 *
 * `registeredId` 를 주면 서버가 그 건을 풀에서 뺍니다. 방금 등록한 화물이
 * "풀에 있는 화물"과 "지금 입력"으로 두 번 세지 않게 하려는 것입니다.
 */
export function requestMatching(
  shipment: ShipmentInput | null = null,
  registeredId?: string | null,
): Promise<MatchResult> {
  return postJson<MatchResult>('/api/matching/request', {
    ...(shipment ? { shipment } : {}),
    ...(registeredId ? { registeredId } : {}),
  });
}

// ── #12 CSV 다건 등록 ──────────────────────────────────────────

export interface BulkRowResult {
  row: number;
  ok: boolean;
  errors?: Record<string, string>;
  raw?: unknown;
}

export interface BulkResult {
  mode: 'preview' | 'commit';
  total: number;
  registered: Shipment[];
  skipped: BulkRowResult[];
}

/**
 * CSV 로 여러 건을 한 번에 등록합니다. **미리보기 → 확정** 2단계입니다 —
 * 검증만 먼저 돌려 몇 건이 걸리는지 보여주고, 확인한 뒤에만 실제로 넣습니다.
 */
export function bulkFreights(csv: string, commit: boolean): Promise<BulkResult> {
  return postJson<BulkResult>('/api/freights/bulk', { csv, commit });
}
