import { Fragment } from 'react';
import {
  AiParagraphBlock,
  DocCell,
  DocLegend,
  DocRow,
  DocSectionTitle,
  DocSheet,
  DocTable,
  FormulaBadge,
} from '../components/DocTable';
import { SUBSIDY_DISCLAIMER, type ParagraphKey } from '../lib/subsidy';
import type { ApplyDocView } from '../lib/subsidy-view';

const PLAN_COLS = '1.4fr 1fr 1fr 0.9fr 1fr';
const COST_COLS = '1.2fr 1.6fr 1fr';
const BENEFIT_COLS = '1.1fr 1.1fr 1.1fr 1fr';
const SUBSIDY_COLS = '1.4fr 1.6fr 1fr';

export interface ApplyDocumentProps {
  /** #33 이 준 문서를 서식 표기로 옮긴 것 (`toApplyDocView`) */
  doc: ApplyDocView;
  /** #36 문단 단위 재생성 */
  onRegenerate?: (key: ParagraphKey) => void;
  /** 재생성 중인 문단 — 해당 블록만 잠깁니다 */
  busyKeys?: ParagraphKey[];
}

/** 06c 탭 1 — 전환교통 지원사업 사업계획서 (별지 제3호 서식) */
export function ApplyDocument({ doc, onRegenerate, busyKeys = [] }: ApplyDocumentProps) {
  /** 문단 블록. 서식의 각 장 아래에 붙습니다. */
  const para = (key: ParagraphKey, className: string) => {
    const p = doc.paragraphs[key];
    return (
      <AiParagraphBlock
        className={className}
        body={p.text}
        tone={p.tone}
        label={p.label}
        busy={busyKeys.includes(key)}
        onRegenerate={onRegenerate ? () => onRegenerate(key) : undefined}
      />
    );
  };

  return (
    <DocSheet>
      <header className="border-b-2 border-[#191F28] pb-[22px] text-center">
        <div className="text-[15px] font-semibold tracking-wide text-[#6B7684]">{doc.header.formNo}</div>
        <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-[#191F28]">{doc.header.title}</h2>
        <div className="mt-3 text-[13px] leading-[1.7] text-[#6B7684]">
          {doc.header.basis}
          <br />
          {doc.header.org}
        </div>
      </header>

      <DocLegend note={SUBSIDY_DISCLAIMER} />

      {para('overview', '')}

      <section>
        <DocSectionTitle>1. 신청인</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            <div className="grid" style={{ gridTemplateColumns: '130px 1fr 130px 1fr' }}>
              {doc.applicant.map((f) =>
                f.wide ? (
                  <Fragment key={f.label}>
                    <DocCell label>{f.label}</DocCell>
                    <DocCell span={3} last>
                      {f.value}
                    </DocCell>
                  </Fragment>
                ) : (
                  <Fragment key={f.label}>
                    <DocCell label className="border-b border-[#D1D6DB]">
                      {f.label}
                    </DocCell>
                    <DocCell className="border-b border-[#D1D6DB]">{f.value}</DocCell>
                  </Fragment>
                ),
              )}
            </div>
          </DocTable>
        </div>
      </section>

      <section>
        <DocSectionTitle>2. 전환 계획</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            <DocRow cols={PLAN_COLS} head>
              <DocCell>구간</DocCell>
              <DocCell>품목</DocCell>
              <DocCell right>전환물량</DocCell>
              <DocCell right>수송횟수</DocCell>
              <DocCell right last>
                화차형식
              </DocCell>
            </DocRow>

            {doc.plan.rows.map((r) => (
              <DocRow key={`${r.route}·${r.item}`} cols={PLAN_COLS}>
                <DocCell>{r.route}</DocCell>
                <DocCell>{r.item}</DocCell>
                <DocCell right className="tabular-nums">
                  {r.tons}
                </DocCell>
                <DocCell right className="tabular-nums">
                  {r.trips}
                </DocCell>
                <DocCell right last>
                  {r.wagonType}
                </DocCell>
              </DocRow>
            ))}

            <DocRow cols={PLAN_COLS} total>
              <DocCell>{doc.plan.total.route}</DocCell>
              <DocCell>{doc.plan.total.item}</DocCell>
              <DocCell right className="tabular-nums">
                {doc.plan.total.tons}
              </DocCell>
              <DocCell right className="tabular-nums">
                {doc.plan.total.trips}
              </DocCell>
              <DocCell right last>
                {doc.plan.total.wagonType}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>

        <div className="mt-2 text-xs text-[#6B7684]">{doc.plan.note}</div>

        {para('plan', 'mt-3')}
      </section>

      <section>
        <DocSectionTitle>3. 추가비용 산출</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            <DocRow cols={COST_COLS} head>
              <DocCell>항목</DocCell>
              <DocCell>산식</DocCell>
              <DocCell right last>
                금액
              </DocCell>
            </DocRow>

            {doc.extraCost.rows.map((r) => (
              <DocRow key={r.label} cols={COST_COLS}>
                <DocCell>{r.label}</DocCell>
                <DocCell>
                  <FormulaBadge numeric>{r.formula}</FormulaBadge>
                </DocCell>
                <DocCell right last className="tabular-nums">
                  {r.amount}
                </DocCell>
              </DocRow>
            ))}

            <DocRow cols={COST_COLS} total>
              <DocCell>{doc.extraCost.total.label}</DocCell>
              <DocCell className="text-[13px] font-semibold text-[#6B7684]">
                {doc.extraCost.total.formula}
              </DocCell>
              <DocCell right last className="tabular-nums">
                {doc.extraCost.total.amount}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>

        {para('extraCost', 'mt-3')}
      </section>

      <section>
        <DocSectionTitle>4. 사회환경적 편익</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            <DocRow cols={BENEFIT_COLS} head>
              <DocCell>편익 항목</DocCell>
              <DocCell>산출 근거</DocCell>
              <DocCell>계수 출처</DocCell>
              <DocCell right last>
                환산액
              </DocCell>
            </DocRow>

            {doc.benefit.rows.map((r) => (
              <DocRow key={r.label} cols={BENEFIT_COLS}>
                <DocCell>{r.label}</DocCell>
                <DocCell>
                  <FormulaBadge numeric>{r.basis}</FormulaBadge>
                </DocCell>
                <DocCell className="text-xs text-[#6B7684]">{r.source}</DocCell>
                <DocCell right last className="tabular-nums">
                  {r.amount}
                </DocCell>
              </DocRow>
            ))}

            <DocRow cols={BENEFIT_COLS} total>
              <DocCell>편익 계</DocCell>
              <DocCell />
              <DocCell />
              <DocCell right last className="tabular-nums">
                {doc.benefit.total}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>

        <div className="mt-2 text-xs leading-[1.7] text-[#6B7684]">{doc.benefit.note}</div>

        {para('benefit', 'mt-3')}
      </section>

      <section>
        <DocSectionTitle>5. 보조금 산정 결과</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            {doc.subsidy.rows.map((r) => (
              <DocRow key={r.label} cols={SUBSIDY_COLS}>
                <DocCell label>{r.label}</DocCell>
                <DocCell>
                  <FormulaBadge numeric>{r.formula}</FormulaBadge>
                </DocCell>
                <DocCell right last className="tabular-nums">
                  {r.amount}
                </DocCell>
              </DocRow>
            ))}

            <DocRow cols={SUBSIDY_COLS} accent>
              <DocCell className="py-[13px]">{doc.subsidy.result.label}</DocCell>
              <DocCell className="py-[13px] text-[13px] font-semibold text-[#1B64DA]">
                {doc.subsidy.result.formula}
              </DocCell>
              <DocCell right last className="py-[13px] text-base tabular-nums">
                {doc.subsidy.result.amount}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>

        {para('result', 'mt-3')}
      </section>

      <section>
        <DocSectionTitle>6. 첨부 서류</DocSectionTitle>
        <div className="mt-2.5 flex flex-col gap-[7px] text-sm text-[#333D4B]">
          {doc.attachments.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>

        {para('closing', 'mt-3.5')}
      </section>

      <footer className="mt-3 border-t border-[#E5E8EB] pt-5 text-center text-[13px] leading-[1.9] text-[#4E5968]">
        위와 같이 전환교통 지원사업 사업계획서를 제출합니다.
        <br />
        <b className="text-[#191F28]">{doc.header.sign}</b>
        <br />
        <span className="text-xs text-[#8B95A1]">계수 버전 {doc.meta.coefficientVersion}</span>
      </footer>
    </DocSheet>
  );
}
