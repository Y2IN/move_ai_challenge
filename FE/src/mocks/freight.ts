export type FreightItem = '석유화학제품' | '화학원료' | '철강재' | '기타';
export type CorpType = '중소기업' | '우수물류기업' | '일반';

export interface FreightForm {
  from: string;
  to: string;
  item: FreightItem;
  tons: string;
  departDate: string;
  corpType: CorpType;
}

export type FreightField = keyof FreightForm;

export const FREIGHT_ITEMS: FreightItem[] = ['석유화학제품', '화학원료', '철강재', '기타'];
export const CORP_TYPES: CorpType[] = ['중소기업', '우수물류기업', '일반'];

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
};

/** 자연어 파싱 결과. 기업 구분은 AI가 채우지 않는다 */
export const parsedForm: FreightForm = {
  from: '울산 공장',
  to: '의왕ICD',
  item: '석유화학제품',
  tons: '1860',
  departDate: '2026-08-18',
  corpType: '중소기업',
};

export const aiFilledFields: FreightField[] = ['from', 'to', 'item', 'tons', 'departDate'];

export const sideNote = {
  title: '소량 화물도 괜찮습니다',
  body: '단독으로 화차를 채우지 못하는 소량 화물도 등록할 수 있습니다. 동일 노선 화주와 자동으로 묶입니다.',
};
