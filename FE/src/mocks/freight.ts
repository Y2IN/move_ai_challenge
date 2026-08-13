import type { CompanyGrade, TransportArrangement } from '@railhub/be/types';

export type FreightItem = '석유화학제품' | '화학원료' | '철강재' | '기타';
export type CorpType = '중소기업' | '우수물류기업' | '일반';
export type TransportMode = '자차' | '위탁';

export interface FreightForm {
  from: string;
  to: string;
  item: FreightItem;
  tons: string;
  departDate: string;
  corpType: CorpType;
  transportMode: TransportMode;
}

export type FreightField = keyof FreightForm;

export const FREIGHT_ITEMS: FreightItem[] = ['석유화학제품', '화학원료', '철강재', '기타'];
export const CORP_TYPES: CorpType[] = ['중소기업', '우수물류기업', '일반'];

/**
 * 기업 구분 화면 표시값(한글) ↔ 서버 enum(CompanyGrade) 매핑.
 * 운송방식과 동일하게 화면은 한글 유지, 등록 API 호출 시에만 변환한다.
 *   body.companyGrade = CORP_TYPE_TO_API[form.corpType]
 */
export const CORP_TYPE_TO_API: Record<CorpType, CompanyGrade> = {
  중소기업: 'sme',
  우수물류기업: 'excellentLogistics',
  일반: 'general',
};

export const CORP_TYPE_FROM_API: Record<CompanyGrade, CorpType> = {
  sme: '중소기업',
  excellentLogistics: '우수물류기업',
  general: '일반',
};
export const TRANSPORT_MODES: TransportMode[] = ['자차', '위탁'];

/**
 * 화면 표시값(한글) ↔ 서버 enum(TransportArrangement) 매핑.
 * 화면·폼은 '자차'/'위탁' 그대로 쓰고, 등록 API 호출 시에만 아래로 변환한다.
 *   body.transportArrangement = TRANSPORT_MODE_TO_API[form.transportMode]
 * 반대로 서버 응답을 화면에 그릴 땐 TRANSPORT_MODE_FROM_API 로 되돌린다.
 * (BE 타입을 직접 import 하므로 enum 값이 어긋나면 타입체크에서 잡힌다.)
 */
export const TRANSPORT_MODE_TO_API: Record<TransportMode, TransportArrangement> = {
  자차: 'own',
  위탁: 'consignment',
};

export const TRANSPORT_MODE_FROM_API: Record<TransportArrangement, TransportMode> = {
  own: '자차',
  consignment: '위탁',
};

export const naturalPlaceholder =
  '울산 공장에서 의왕ICD까지 석유화학제품 1,860톤, 다음 주 화요일 출발';

/** AI로 채우기를 누르기 전 상태 */
export const emptyForm: FreightForm = {
  from: '',
  to: '',
  item: '석유화학제품',
  tons: '',
  departDate: '',
  corpType: '중소기업',
  transportMode: '위탁',
};

/** 자연어 파싱 결과. 기업 구분은 AI가 채우지 않는다 */
export const parsedForm: FreightForm = {
  from: '울산 공장',
  to: '의왕ICD',
  item: '석유화학제품',
  tons: '1860',
  departDate: '2026-08-18',
  corpType: '중소기업',
  transportMode: '위탁',
};

export const aiFilledFields: FreightField[] = ['from', 'to', 'item', 'tons', 'departDate'];

export const sideNote = {
  title: '소량 화물도 괜찮습니다',
  body: '단독으로 화차를 채우지 못하는 소량 화물도 등록할 수 있습니다. 동일 노선 화주와 자동으로 묶입니다.',
};
