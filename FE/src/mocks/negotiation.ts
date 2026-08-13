/** 04c~04e 공통 — 울산 → 의왕ICD 편성 조율 시나리오 */

export const wagon = {
  code: 'KRC-1204',
  route: '울산 → 의왕ICD',
  departAt: '2026.08.18 06:20',
  type: '컨테이너 화차',
  capacityTons: '4,550톤',
  minLoadRate: '60%',
  minLoadTons: '2,730톤',
  totalTons: '4,280톤 · 12회',
  finalLoadRate: 94,
};

export const unmatched = {
  loadRate: 41,
  headline: '합적 그룹을 만들지 못했습니다 · 대성물산 1,860톤 단독, 적재율 41%로 최소 기준 60% 미달',
  soloShipper: '대성물산 1,860톤',
};

export type NegoKind = '발송일 조정' | '물량 당김' | '인도역 변경';

export interface CandidateShipper {
  name: string;
  tons: string;
  /** 어긋난 조건 */
  conflict: string;
  kind: NegoKind;
  /** 조율 여지가 없는 화주는 회색 배지 */
  adjustable: boolean;
}

export const candidates: CandidateShipper[] = [
  {
    name: '한림케미칼',
    tons: '1,540톤',
    conflict: '희망 발송 08.17 · 화차 출발 08.18과 1일 어긋남',
    kind: '발송일 조정',
    adjustable: true,
  },
  {
    name: '우진산업',
    tons: '880톤',
    conflict: '다음 주 예정 물량 · 이번 편성 대상 아님',
    kind: '물량 당김',
    adjustable: true,
  },
  {
    name: '남광유화',
    tons: '720톤',
    conflict: '부산신항 인도 필요 · 의왕ICD 인수 불가',
    kind: '인도역 변경',
    adjustable: false,
  },
];

export const agentNote = {
  title: '조율 에이전트',
  body: '화주가 문장으로 적은 제약을 절대 조건과 조정 가능 조건으로 나누고, 양보를 요청할 화주와 그 화주에게 통할 근거를 함께 만듭니다.',
  caveat: '양보 대가가 절감액보다 큰 화주에게는 제안하지 않습니다.',
};

/* ── 04d ────────────────────────────────────────────── */

export type ConstraintKind = 'absolute' | 'adjustable';

export interface ConstraintTag {
  kind: ConstraintKind;
  label: string;
}

export interface ShipperProfile {
  name: string;
  tons: string;
  /** 성향 배지 */
  trait: string;
  traitTone: 'none' | 'active' | 'rigid';
  /** 화주가 쓴 문장 그대로 */
  quote: string;
  tags: ConstraintTag[];
  excluded?: boolean;
}

export const shipperProfiles: ShipperProfile[] = [
  {
    name: '대성물산',
    tons: '1,860톤',
    trait: '요청 없음',
    traitTone: 'none',
    quote: '"특별한 조건 없습니다"',
    tags: [],
  },
  {
    name: '한림케미칼',
    tons: '1,540톤',
    trait: '가격 민감 높음',
    traitTone: 'active',
    quote: '"22일까지 도착이면 됩니다. 창고 공간은 여유 있어요"',
    tags: [
      { kind: 'absolute', label: '절대 · 08.22 도착' },
      { kind: 'adjustable', label: '조정 가능 · 발송일 1~2일' },
    ],
  },
  {
    name: '우진산업',
    tons: '880톤',
    trait: '적극',
    traitTone: 'active',
    quote: '"다음 주 물량인데 미리 나가도 상관없습니다"',
    tags: [{ kind: 'adjustable', label: '조정 가능 · 물량 당김' }],
  },
  {
    name: '남광유화',
    tons: '720톤',
    trait: '납기 경직 높음',
    traitTone: 'rigid',
    quote: '"의왕ICD 말고 부산신항으로 받아야 합니다"',
    tags: [{ kind: 'absolute', label: '절대 · 부산신항 인도' }],
    excluded: true,
  },
];

export type StepStatus = 'accepted' | 'conditional' | 'rejected';

export interface NegoStep {
  id: string;
  title: string;
  status: StepStatus;
  statusLabel: string;
  /** 수락 시 절감률 */
  saving?: string;
  /** AI가 화주에게 보낸 설득 문장 */
  message?: string;
  /** 화주 회신 또는 산출 근거 */
  note?: string;
}

export const negoSteps: NegoStep[] = [
  {
    id: 's1',
    title: '대성물산 · 요청 없음',
    status: 'accepted',
    statusLabel: '수락',
    saving: '16%',
    note: '조건 변경 없이 합적 편성 참여',
  },
  {
    id: 's2',
    title: '한림케미칼 · 발송 2일 연기 요청',
    status: 'conditional',
    statusLabel: '조건부 수락',
    message:
      '08.17 발송을 08.19로 옮기시면 단독 발송 대비 운송비를 19% 아낄 수 있습니다. 도착은 08.21로 기한 하루 전입니다.',
    note: '회신 · 2일은 어렵고 1일까지만 가능합니다 (납기 여유 1일)',
  },
  {
    id: 's3',
    title: '한림케미칼 · 1일 연기로 재제안 (08.18)',
    status: 'accepted',
    statusLabel: '수락',
    saving: '19%',
    note: '보관비 620만 원 대비 절감 2,180만 원 · 적재율 41% → 75%',
  },
  {
    id: 's4',
    title: '우진산업 · 다음 주 물량 880톤 당김 요청',
    status: 'accepted',
    statusLabel: '수락',
    saving: '24%',
    message:
      '이미 확정된 편성에 편승하는 방식이라 별도 배차 없이 나갑니다. 단독 발송 대비 24% 저렴하고, 조기 출고비를 감안해도 1,790만 원 남습니다.',
    note: '적재율 75% → 94%',
  },
  {
    id: 's5',
    title: '남광유화 · 인도역 변경 요청',
    status: 'rejected',
    statusLabel: '거절',
    note: '부산신항 인도가 절대 조건 · 의왕ICD에서 추가 트럭 운임 4,300만 원이 절감액 2,600만 원을 초과해 편성에서 제외',
  },
];

export const gauge = {
  start: 41,
  mid: 75,
  end: 94,
  minRate: 60,
  startLabel: '대성물산 단독',
  midLabel: '한림케미칼 합류',
  endLabel: '우진산업 합류',
};

export const negoMeta = {
  retries: '재탐색 2회 · 응답 마감 08.16 18:00',
  summary: '화주 3곳 수락 · 1곳 제외 · 적재율 94%',
};

/* ── 04e ────────────────────────────────────────────── */

export interface ConfirmedShipper {
  name: string;
  detail: string;
  saving: string;
}

export const confirmedShippers: ConfirmedShipper[] = [
  { name: '대성물산', detail: '1,860톤 · 석유화학제품 · 조건 변경 없음', saving: '16% 절감' },
  { name: '한림케미칼', detail: '1,540톤 · 화학원료 · 발송 08.17 → 08.18', saving: '19% 절감' },
  { name: '우진산업', detail: '880톤 · 철강재 · 다음 주 물량 당김', saving: '24% 절감' },
];

export const confirmHeadline =
  '조율 3회로 편성 확정 · 컨테이너 화차 1편성 · 적재율 94% · 평균 운송비 18% 절감';

export const excludedNote =
  '부산신항 인도가 절대 조건, 추가 트럭 운임 4,300만 원이 절감액 2,600만 원을 초과합니다. 다음 부산신항 공차 일정에 우선 배정 대기로 등록했습니다.';

export const costCompare = {
  road: { cost: '5억 800만', carbon: '246 tCO₂eq' },
  rail: { cost: '4억 1,500만', carbon: '64 tCO₂eq' },
  savingRate: '18%',
};
