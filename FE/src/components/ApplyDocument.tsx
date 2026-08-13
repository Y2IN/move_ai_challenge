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
import {
  applicant,
  applyMeta,
  attachments,
  benefitDocRows,
  benefitDocTotal,
  costRows,
  costTotal,
  docHeader,
  paragraphs,
  planRows,
  planTotal,
  subsidyResult,
  subsidyRows,
} from '../mocks/apply';

const PLAN_COLS = '1.4fr 1fr 1fr 0.9fr 1fr';
const COST_COLS = '1.2fr 1.6fr 1fr';
const BENEFIT_COLS = '1.1fr 1.1fr 1.1fr 1fr';
const SUBSIDY_COLS = '1.4fr 1.6fr 1fr';

/** 06c 탭 1 — 전환교통 지원사업 사업계획서 */
export function ApplyDocument({ onRegenerate }: { onRegenerate?: (id: string) => void }) {
  return (
    <DocSheet>
      <header className="border-b-2 border-[#191F28] pb-[22px] text-center">
        <div className="text-[15px] font-semibold tracking-wide text-[#6B7684]">{docHeader.formNo}</div>
        <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-[#191F28]">{docHeader.title}</h2>
        <div className="mt-3 text-[13px] leading-[1.7] text-[#6B7684]">
          {docHeader.basis}
          <br />
          {docHeader.org}
        </div>
      </header>

      <DocLegend note={applyMeta.disclaimer} />

      <section>
        <DocSectionTitle>1. 신청인</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            <div className="grid" style={{ gridTemplateColumns: '130px 1fr 130px 1fr' }}>
              {applicant.map((f) =>
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

            {planRows.map((r) => (
              <DocRow key={r.section} cols={PLAN_COLS}>
                <DocCell>{r.section}</DocCell>
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
              <DocCell>{planTotal.section}</DocCell>
              <DocCell>{planTotal.item}</DocCell>
              <DocCell right className="tabular-nums">
                {planTotal.tons}
              </DocCell>
              <DocCell right className="tabular-nums">
                {planTotal.trips}
              </DocCell>
              <DocCell right last>
                {planTotal.wagonType}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>

        <AiParagraphBlock
          className="mt-3"
          body={paragraphs.plan.body}
          onRegenerate={() => onRegenerate?.(paragraphs.plan.id)}
        />
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

            {costRows.map((r) => (
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
              <DocCell>{costTotal.label}</DocCell>
              <DocCell className="text-[13px] font-semibold text-[#6B7684]">{costTotal.formula}</DocCell>
              <DocCell right last className="tabular-nums">
                {costTotal.amount}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>
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

            {benefitDocRows.map((r) => (
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
                {benefitDocTotal}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>

        <AiParagraphBlock
          className="mt-3"
          body={paragraphs.benefit.body}
          onRegenerate={() => onRegenerate?.(paragraphs.benefit.id)}
        />
      </section>

      <section>
        <DocSectionTitle>5. 보조금 산정 결과</DocSectionTitle>
        <div className="mt-2.5">
          <DocTable>
            {subsidyRows.map((r) => (
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
              <DocCell className="py-[13px]">{subsidyResult.label}</DocCell>
              <DocCell className="py-[13px] text-[13px] font-semibold text-[#1B64DA]">
                {subsidyResult.formula}
              </DocCell>
              <DocCell right last className="py-[13px] text-base tabular-nums">
                {subsidyResult.amount}
              </DocCell>
            </DocRow>
          </DocTable>
        </div>
      </section>

      <section>
        <DocSectionTitle>6. 첨부 서류</DocSectionTitle>
        <div className="mt-2.5 flex flex-col gap-[7px] text-sm text-[#333D4B]">
          {attachments.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>

        <AiParagraphBlock
          className="mt-3.5"
          body={paragraphs.closing.body}
          onRegenerate={() => onRegenerate?.(paragraphs.closing.id)}
        />
      </section>

      <footer className="mt-3 border-t border-[#E5E8EB] pt-5 text-center text-[13px] leading-[1.9] text-[#4E5968]">
        위와 같이 전환교통 지원사업 사업계획서를 제출합니다.
        <br />
        <b className="text-[#191F28]">{docHeader.sign}</b>
      </footer>
    </DocSheet>
  );
}
