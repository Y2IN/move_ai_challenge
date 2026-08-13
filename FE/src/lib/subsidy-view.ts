/**
 * `SubsidyDocument`(숫자) → 별지 제3호 서식 표기(문자열).
 *
 * **여기서 계산하지 않습니다.** BE가 준 값을 서식 표기로 옮기기만 합니다.
 * 값을 조합해 새 숫자를 만들면 "수치는 법정 산식으로 계산된다"는 문서의 전제가
 * 깨집니다 — 합계·차감은 전부 BE가 이미 계산해서 내려줍니다.
 */

import type { ParagraphTone } from '../components/DocTable';
import {
  formatDocDate,
  formatKrw,
  formatKrwExact,
  formatNumber,
  formatPct,
  formatTon,
  formatTrips,
  formatWonSign,
} from './format';
import { PARAGRAPH_ORDER, type Paragraph, type ParagraphKey, type SubsidyDocument } from './subsidy';

export interface DocFieldView {
  label: string;
  value: string;
  wide?: boolean;
}

export interface PlanRowView {
  route: string;
  item: string;
  tons: string;
  trips: string;
  wagonType: string;
}

export interface AmountRowView {
  label: string;
  formula: string;
  amount: string;
}

export interface BenefitRowView {
  label: string;
  basis: string;
  source: string;
  amount: string;
}

export interface ParagraphView {
  key: ParagraphKey;
  text: string;
  tone: ParagraphTone;
  /** 배지 옆 문구를 덮어씁니다. 생략하면 tone 기본 문구 */
  label?: string;
  /** 아직 생성 전 — 본문 대신 자리표시 문구가 들어갑니다 */
  pending: boolean;
}

export interface ApplyDocView {
  header: { formNo: string; title: string; basis: string; org: string; sign: string };
  applicant: DocFieldView[];
  plan: { rows: PlanRowView[]; total: PlanRowView; note: string };
  extraCost: { rows: AmountRowView[]; total: AmountRowView };
  benefit: { rows: BenefitRowView[]; total: string; note: string };
  subsidy: { rows: AmountRowView[]; result: AmountRowView };
  attachments: string[];
  paragraphs: Record<ParagraphKey, ParagraphView>;
  panel: {
    a: { label: string; value: string; adopted: boolean };
    b: { label: string; value: string; adopted: boolean };
    resultLabel: string;
    result: string;
    resultKrw: string;
    caution: string;
  };
  meta: {
    periodLabel: string;
    generatedAt: string;
    eligible: boolean;
    coefficientVersion: string;
  };
}

/** BE 문단 출처 → 화면 톤. `pending` 은 아직 생성 전이라 템플릿과 같은 회색입니다. */
const TONE_BY_SOURCE: Record<Paragraph['source'], ParagraphTone> = {
  ai: 'ai',
  fallback: 'fallback',
  user: 'user',
  pending: 'fallback',
};

const PENDING_TEXT = '아직 생성되지 않은 문단입니다. ↻ 를 눌러 작성하세요.';

function toParagraphView(p: Paragraph | undefined, key: ParagraphKey): ParagraphView {
  if (!p || p.source === 'pending' || !p.text) {
    return { key, text: PENDING_TEXT, tone: 'fallback', label: '생성 대기', pending: true };
  }
  return {
    key,
    text: p.text,
    tone: TONE_BY_SOURCE[p.source],
    label: p.editedByUser ? '직접 편집한 문단 · 재생성해도 보존됩니다' : undefined,
    pending: false,
  };
}

/** "2026-08-13T05:11:10.000Z" → "2026년 8월 13일" */
function koreanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 합계 산식 문구를 행 라벨에서 만듭니다. 음수 행은 − 로 이어 붙습니다. */
function totalFormula(rows: { label: string; amount: number }[]): string {
  return rows
    .map((r, i) => {
      const name = r.label.replace(/\s*\(차감\)\s*$/, '');
      if (i === 0) return name;
      return `${r.amount < 0 ? '−' : '+'} ${name}`;
    })
    .join(' ');
}

export function toApplyDocView(doc: SubsidyDocument): ApplyDocView {
  const { meta, sections } = doc;
  const { applicant, plan, extraCost, benefit, result, attachments } = sections;
  const docDate = meta.createdAt.slice(0, 10);

  const paragraphs = {} as Record<ParagraphKey, ParagraphView>;
  for (const key of PARAGRAPH_ORDER) {
    paragraphs[key] = toParagraphView(doc.paragraphs[key], key);
  }

  // 보조금 상한(B)의 근거는 **협회 공식 원단위로 산정한 절감액**입니다.
  // 편익 표의 합계(totalB)는 대시보드 표시용 추정치라 값이 달라, 이걸로 B를
  // 설명하면 문서 안에서 앞뒤가 안 맞습니다. (BE report/fixture.ts 주석 참고)
  const official = benefit.official;

  return {
    header: {
      formNo: `[${meta.form} 서식]`,
      title: '「전환교통 지원사업 사업계획서」',
      basis: `근거: ${result.legalBasis}`,
      org: `접수기관: 한국철도물류협회 (국토교통부 위탁) · 작성일 ${formatDocDate(docDate)}`,
      sign: `${koreanDate(meta.createdAt)} · 신청인 ${applicant.name} 대표자 ${applicant.ceo} (인)`,
    },

    applicant: [
      { label: '상호', value: applicant.name },
      { label: '사업자등록번호', value: applicant.bizNo },
      { label: '대표자', value: applicant.ceo },
      { label: '담당자', value: `${applicant.manager} · ${applicant.phone}` },
      { label: '소재지', value: applicant.address, wide: true },
    ],

    plan: {
      rows: plan.rows.map((r) => ({
        route: r.route,
        item: r.item,
        tons: formatTon(r.tons),
        trips: formatTrips(r.trips),
        wagonType: r.wagonType,
      })),
      total: {
        route: '합계',
        item: `${formatNumber(plan.total.itemCount)}개 품목`,
        tons: formatTon(plan.total.tons),
        trips: formatTrips(plan.total.trips),
        wagonType: `${formatNumber(plan.total.wagonTypeCount)}종`,
      },
      note: `전 구간 평균 적재율 ${formatPct(plan.avgLoadRate)}`,
    },

    extraCost: {
      rows: extraCost.rows.map((r) => ({
        label: r.label,
        formula: r.formula,
        amount: formatKrwExact(r.amount),
      })),
      total: {
        label: '추가비용 계 (A)',
        formula: totalFormula(extraCost.rows),
        amount: formatKrwExact(extraCost.totalA),
      },
    },

    benefit: {
      rows: benefit.items.map((r) => ({
        label: r.label,
        basis: r.basis,
        source: r.source,
        amount: formatKrwExact(r.amount),
      })),
      total: formatKrwExact(benefit.totalB),
      note:
        `※ 이 합계는 공시용 추정치입니다. 보조금 상한(B)의 근거는 ` +
        `${official.year}년 협회 공식 원단위(도로 ${official.roadUnitCost} / 철도 ${official.railUnitCost} 원·ton·km)로 ` +
        `산정한 절감액 ${formatKrwExact(official.savingKrw)} 입니다.`,
    },

    subsidy: {
      rows: [
        {
          label: '추가비용 (A)',
          formula: '3. 추가비용 산출 합계',
          amount: formatKrwExact(result.A),
        },
        {
          label: '편익 × 30% (B)',
          formula: `${formatNumber(official.savingKrw)} × 0.3`,
          amount: formatKrwExact(result.B),
        },
      ],
      result: meta.eligible
        ? {
            label: '보조금 신청액',
            formula: `min(A, B) · ${result.adopted} 채택`,
            amount: formatKrwExact(result.subsidy),
          }
        : {
            // A ≤ 0 이면 전환으로 추가비용이 발생하지 않아 지원 대상이 아닙니다.
            // 이걸 0원으로만 적으면 "계산이 덜 됐다"로 읽히므로 사유를 함께 적습니다.
            label: '보조금 신청 대상 아님',
            formula: '추가비용(A) ≤ 0 · 철도 전환으로 비용이 증가하지 않았습니다',
            amount: formatKrwExact(result.subsidy),
          },
    },

    attachments: attachments.items,

    paragraphs,

    panel: {
      a: { label: '추가비용 (A)', value: formatKrw(result.A), adopted: result.adopted === 'A' },
      b: { label: '편익 × 30% (B)', value: formatKrw(result.B), adopted: result.adopted === 'B' },
      resultLabel: meta.eligible ? '보조금 신청액 = min(A, B)' : '보조금 신청 대상 아님',
      result: formatKrw(result.subsidy),
      resultKrw: formatWonSign(result.subsidy),
      caution: meta.eligible
        ? '제출 전 5번 항목의 산정 결과를 관할 지자체 담당자와 확인하세요.'
        : '추가비용이 발생하지 않아 보조금 신청 대상이 아닙니다. 편익은 공시 자산으로 활용하세요.',
    },

    meta: {
      periodLabel: `${meta.period.label} 실적 기준`,
      generatedAt: `${meta.period.from} ~ ${meta.period.to} · ${meta.paragraphCount}개 문단`,
      eligible: meta.eligible,
      coefficientVersion: meta.coefficientVersion,
    },
  };
}
