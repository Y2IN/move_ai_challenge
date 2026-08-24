import type { ReactNode } from 'react';
import { AiChip, MiniAiParagraph, MiniFormula, MiniSheet, MiniSheetHeader } from './LandingSection';
import { formatKrwExact, formatNumber } from '../lib/format';
import type { PublicStats } from '../lib/public';
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

/** 좁은 화면에서 칸을 줄이는 대신 표만 가로 스크롤시킨다 — 서식 유지 */
function MiniTableScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="min-w-[420px] border border-[#B0B8C1] text-[11px]">{children}</div>
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

/**
 * 01 랜딩 — 보조금 사업계획서 미리보기.
 *
 * **표 안의 금액은 실제 집계(#6)입니다.** 예시 숫자를 박아 두면, 심사위원이 이
 * 미리보기와 실제 신청서(06c)를 나란히 열었을 때 두 문서의 금액이 다릅니다.
 * 수치가 오기 전에는 표를 흐리게 두고 값 자리를 비웁니다.
 */
export function PlanDocPreview({ stats }: { stats: PublicStats | null }) {
  const d = planDocPreview;
  const total = stats ? stats.breakdown.reduce((sum, b) => sum + b.amountKrw, 0) : 0;
  return (
    <div className="flex flex-col gap-3.5">
      <PreviewHead title={d.title} formats={d.formats} />
      <p className="text-[15px] leading-[1.65] text-[#6B7684]">{d.desc}</p>

      <MiniSheet>
        <MiniSheetHeader formNo={d.formNo} title={d.docTitle} />

        <div>
          <div className="text-[13px] font-extrabold text-[#191F28]">4. 사회환경적 편익</div>
          <MiniTableScroll className="mt-2">
            <Row cols={BENEFIT_COLS} head>
              <Cell head>편익 항목</Cell>
              <Cell head>계수 출처</Cell>
              <Cell head right last>
                환산액
              </Cell>
            </Row>

            {d.benefitRows.map((r, i) => (
              <Row key={r.label} cols={BENEFIT_COLS}>
                <Cell>{stats ? stats.breakdown[i]?.label ?? r.label : r.label}</Cell>
                <Cell muted>{r.source}</Cell>
                <Cell right last>
                  {stats ? formatKrwExact(stats.breakdown[i]?.amountKrw ?? 0) : '—'}
                </Cell>
              </Row>
            ))}

            <Row cols={BENEFIT_COLS} total last>
              <Cell>편익 계</Cell>
              <Cell />
              <Cell right last>
                {stats ? formatKrwExact(total) : '—'}
              </Cell>
            </Row>
          </MiniTableScroll>
        </div>

        <div>
          <div className="text-[13px] font-extrabold text-[#191F28]">5. 보조금 산정 결과</div>
          <MiniTableScroll className="mt-2">
            <Row cols={SUBSIDY_COLS}>
              <Cell head>추가비용 (A)</Cell>
              <Cell>
                <MiniFormula>3. 추가비용 합계</MiniFormula>
              </Cell>
              <Cell right last>
                {/* A 는 신청서에서만 산출됩니다. 미리보기에 없는 값을 지어내지 않습니다 */}
                <span className="text-[#B0B8C1]">신청서에서 산출</span>
              </Cell>
            </Row>

            <Row cols={SUBSIDY_COLS}>
              {/*
                고시상 B 가 아니라 **위 편익 계에 상한 비율을 적용해 본 참고치**입니다.
                고시 B 는 협회 공고의 통합 원단위로 따로 산정하므로 값이 다릅니다
                (`MODAL_SHIFT_UNIT_COST` — 4항목 분해 합계와 일치하지 않습니다).
                "(B)" 라고 적으면 신청서의 B 와 같은 값으로 읽힙니다.
              */}
              <Cell head>편익의 30% (참고)</Cell>
              <Cell>
                <MiniFormula>{stats ? `${formatNumber(total)} × 0.3` : '편익 계 × 0.3'}</MiniFormula>
              </Cell>
              <Cell right last>
                {stats ? formatKrwExact(Math.round(total * 0.3)) : '—'}
              </Cell>
            </Row>

            <Row cols={SUBSIDY_COLS} accent last>
              <Cell>{d.subsidyResult.label}</Cell>
              <Cell>
                <span className="font-semibold text-[#1B64DA]">{d.subsidyResult.formula}</span>
              </Cell>
              <Cell right last>
                {/*
                  신청액은 min(A, B) 라 **A 없이는 구할 수 없습니다.** 위 참고치를
                  그대로 신청액으로 실으면 안 됩니다 — 실제로 시드 기준 추가비용은
                  음수(철도가 더 쌈)라 산정 결과가 "대상 아님 · 0원" 이고,
                  랜딩에서 금액을 띄우면 로그인 후 신청서와 정반대가 됩니다.
                */}
                <span className="text-xs text-[#B0B8C1]">신청서에서 산출</span>
              </Cell>
            </Row>
          </MiniTableScroll>
        </div>

        <MiniAiParagraph body={d.aiParagraph} caption="AI 서술 · 편집 가능" />
      </MiniSheet>
    </div>
  );
}

/**
 * 01 랜딩 — K-ESG 지표표 미리보기.
 *
 * 항목번호·항목명·근거는 지표표 서식이라 고정입니다. 산출값만 #6 에서 옵니다.
 */
export function EsgDocPreview({ stats }: { stats: PublicStats | null }) {
  const d = esgDocPreview;
  return (
    <div className="flex flex-col gap-3.5">
      <PreviewHead title={d.title} formats={d.formats} />
      <p className="text-[15px] leading-[1.65] text-[#6B7684]">{d.desc}</p>

      <MiniSheet>
        <MiniSheetHeader formNo={d.formNo} title={d.docTitle} />

        <MiniTableScroll>
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
                <MiniFormula>{esgValue(r.code, r.value, stats)}</MiniFormula>
              </Cell>
              <Cell last muted>
                {r.source}
              </Cell>
            </Row>
          ))}
        </MiniTableScroll>

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

        <div className="mt-[11px] flex flex-wrap items-center gap-2.5 border-t border-[#F2F4F6] pt-[11px] text-[13px]">
          <span className="rounded-md bg-[#EAF8F1] px-2 py-[3px] font-bold text-[#12A87A]">{output.status}</span>
          <span className="tabular-nums text-[#6B7684]">{output.basis}</span>
          <span className="ml-auto font-bold tabular-nums text-[#191F28]">{output.loadChange}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * E-3-2(온실가스)만 집계에서 채웁니다. 나머지 두 줄은 서식 문구입니다.
 *
 * 집계를 못 받았으면 **'—'** 로 둡니다. 예전에는 목업 상수("182 tCO₂eq 감축")로
 * 떨어져서, 실패했다는 사실이 낡은 숫자 뒤에 숨었습니다.
 */
function esgValue(code: string, fallback: string, stats: PublicStats | null): string {
  if (code !== 'E-3-2') return fallback;
  const ghg = stats?.breakdown.find((b) => b.key === 'ghg');
  return ghg ? `${ghg.quantity} 감축` : fallback || '—';
}
