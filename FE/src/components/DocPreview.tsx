import { AiChip, MiniAiParagraph, MiniFormula, MiniSheet, MiniSheetHeader } from './LandingSection';
import { esgDocPreview, planDocPreview } from '../mocks/marketing';

const BENEFIT_COLS = '1.1fr 1fr 1fr';
const SUBSIDY_COLS = '1.2fr 1.4fr 1fr';
const ESG_COLS = '62px 1.2fr 1.3fr 1fr';

function Cell({
  children,
  right,
  last,
  head,
  muted,
}: {
  children?: React.ReactNode;
  right?: boolean;
  last?: boolean;
  head?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={[
        'px-[9px] py-[7px]',
        last ? '' : 'border-r border-[#D1D6DB]',
        right ? 'text-right tabular-nums' : '',
        head ? 'font-bold text-[#4E5968]' : '',
        muted ? 'text-[#6B7684]' : '',
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function Row({
  cols,
  children,
  head,
  total,
  accent,
  last,
}: {
  cols: string;
  children: React.ReactNode;
  head?: boolean;
  total?: boolean;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={[
        'grid',
        last ? '' : 'border-b border-[#D1D6DB]',
        head ? 'bg-[#F2F4F6]' : 'text-[#191F28]',
        total ? 'bg-[#F9FAFB] font-extrabold' : '',
        accent ? 'bg-[#F5F9FF] font-extrabold' : '',
      ].join(' ')}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

function PreviewHead({ title, formats }: { title: string; formats: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[19px] font-extrabold tracking-[-0.025em] text-[#191F28]">{title}</span>
      <span className="rounded-md bg-[#F2F4F6] px-[9px] py-1 text-xs font-bold text-[#6B7684]">{formats}</span>
    </div>
  );
}

/** 01 랜딩 — 보조금 사업계획서 미리보기 */
export function PlanDocPreview() {
  const d = planDocPreview;
  return (
    <div className="flex flex-col gap-3.5">
      <PreviewHead title={d.title} formats={d.formats} />
      <p className="text-[15px] leading-[1.65] text-[#6B7684]">{d.desc}</p>

      <MiniSheet>
        <MiniSheetHeader formNo={d.formNo} title={d.docTitle} />

        <div>
          <div className="text-[13px] font-extrabold text-[#191F28]">4. 사회환경적 편익</div>
          <div className="mt-2 border border-[#B0B8C1] text-[11px]">
            <Row cols={BENEFIT_COLS} head>
              <Cell head>편익 항목</Cell>
              <Cell head>계수 출처</Cell>
              <Cell head right last>
                환산액
              </Cell>
            </Row>

            {d.benefitRows.map((r) => (
              <Row key={r.label} cols={BENEFIT_COLS}>
                <Cell>{r.label}</Cell>
                <Cell muted>{r.source}</Cell>
                <Cell right last>
                  {r.amount}
                </Cell>
              </Row>
            ))}

            <Row cols={BENEFIT_COLS} total last>
              <Cell>편익 계</Cell>
              <Cell />
              <Cell right last>
                {d.benefitTotal}
              </Cell>
            </Row>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-extrabold text-[#191F28]">5. 보조금 산정 결과</div>
          <div className="mt-2 border border-[#B0B8C1] text-[11px]">
            {d.subsidyRows.map((r) => (
              <Row key={r.label} cols={SUBSIDY_COLS}>
                <Cell head>{r.label}</Cell>
                <Cell>
                  <MiniFormula>{r.formula}</MiniFormula>
                </Cell>
                <Cell right last>
                  {r.amount}
                </Cell>
              </Row>
            ))}

            <Row cols={SUBSIDY_COLS} accent last>
              <Cell>{d.subsidyResult.label}</Cell>
              <Cell>
                <span className="font-semibold text-[#1B64DA]">{d.subsidyResult.formula}</span>
              </Cell>
              <Cell right last>
                <span className="text-xs">{d.subsidyResult.amount}</span>
              </Cell>
            </Row>
          </div>
        </div>

        <MiniAiParagraph body={d.aiParagraph} caption="AI 서술 · 편집 가능" />
      </MiniSheet>
    </div>
  );
}

/** 01 랜딩 — K-ESG 지표표 미리보기 */
export function EsgDocPreview() {
  const d = esgDocPreview;
  return (
    <div className="flex flex-col gap-3.5">
      <PreviewHead title={d.title} formats={d.formats} />
      <p className="text-[15px] leading-[1.65] text-[#6B7684]">{d.desc}</p>

      <MiniSheet>
        <MiniSheetHeader formNo={d.formNo} title={d.docTitle} />

        <div className="border border-[#B0B8C1] text-[11px]">
          <Row cols={ESG_COLS} head>
            <Cell head>항목번호</Cell>
            <Cell head>항목명</Cell>
            <Cell head>산출값</Cell>
            <Cell head last>
              산정 근거
            </Cell>
          </Row>

          {d.rows.map((r, i) => (
            <Row key={r.code} cols={ESG_COLS} last={i === d.rows.length - 1}>
              <Cell>
                <span className="font-bold tabular-nums">{r.code}</span>
              </Cell>
              <Cell>{r.name}</Cell>
              <Cell>
                <MiniFormula>{r.value}</MiniFormula>
              </Cell>
              <Cell last muted>
                {r.source}
              </Cell>
            </Row>
          ))}
        </div>

        <MiniAiParagraph body={d.aiParagraph} caption="AI 서술 · 편집 가능" />

        <div className="border-t border-[#E5E8EB] pt-3 text-[10px] leading-[1.7] text-[#8B95A1]">{d.guideline}</div>
      </MiniSheet>
    </div>
  );
}

/** 01 랜딩 — 조율 에이전트 입력 → 출력 카드 */
export function AgentFlowCard({
  input,
  output,
}: {
  input: { caption: string; quote: string; tags: { kind: 'absolute' | 'adjustable'; label: string }[] };
  output: { caption: string; message: string; status: string; basis: string; loadChange: string };
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-[14px] bg-white px-[18px] py-4">
        <div className="text-xs font-bold text-[#8B95A1]">{input.caption}</div>
        <div className="mt-[7px] text-sm leading-[1.6] text-[#333D4B]">{input.quote}</div>
        <div className="mt-[11px] flex flex-wrap gap-1.5">
          {input.tags.map((t) => (
            <span
              key={t.label}
              className={`rounded-md px-[9px] py-1 text-xs font-semibold ${
                t.kind === 'absolute' ? 'bg-[#F2F4F6] text-[#4E5968]' : 'bg-[#E8F3FF] text-[#1B64DA]'
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center text-[15px] text-[#B0B8C1]">↓</div>

      <div className="rounded-[14px] border-l-[3px] border-[#3182F6] bg-white px-[18px] py-4">
        <div className="flex items-center gap-1.5">
          <AiChip />
          <span className="text-[11px] font-bold text-[#1B64DA]">{output.caption}</span>
        </div>
        <div className="mt-2 text-sm leading-[1.7] text-[#333D4B]">{output.message}</div>

        <div className="mt-[11px] flex items-center gap-2.5 border-t border-[#F2F4F6] pt-[11px] text-[13px]">
          <span className="rounded-md bg-[#EAF8F1] px-2 py-[3px] font-bold text-[#12A87A]">{output.status}</span>
          <span className="tabular-nums text-[#6B7684]">{output.basis}</span>
          <span className="ml-auto font-bold tabular-nums text-[#191F28]">{output.loadChange}</span>
        </div>
      </div>
    </div>
  );
}
