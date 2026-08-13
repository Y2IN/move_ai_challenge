import { Fragment, useState, type ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import {
  achievement,
  contract,
  docChecklist,
  header,
  history,
  historySummary,
  recalcResult,
  recalcRows,
  reportBlockedNote,
  shortfallAlert,
  tripMore,
  tripRows,
  tripSummary,
} from '../mocks/settlement';

const TRIP_COLS = 'grid-cols-[74px_108px_1fr_118px_84px_128px_96px]';
const HISTORY_COLS = 'grid-cols-[1fr_104px_104px_148px_132px_92px]';

function Badge({ children, tone }: { children: ReactNode; tone: 'ok' | 'warn' | 'warnDeep' }) {
  const cls = {
    ok: 'bg-[#EAF8F1] text-[#12A87A]',
    warn: 'bg-[#FFF4E0] text-[#C77700]',
    warnDeep: 'bg-[#FFF4E0] text-[#B45309]',
  }[tone];
  return (
    <span className={`rounded-lg px-2.5 py-[5px] text-[13px] font-bold tabular-nums ${cls}`}>{children}</span>
  );
}

/** 협약 기간 선택. 지금은 표시만 하고 고르면 닫힌다 */
function PeriodSelect() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[34px] items-center gap-2 rounded-[10px] border border-[#E5E8EB] bg-white px-3 text-sm font-bold tracking-[-0.02em] text-[#191F28]"
      >
        <span>{header.periodSelect}</span>
        <span className="text-[11px] text-[#8B95A1]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-20 w-[360px] rounded-[14px] border border-[#E5E8EB] bg-white p-1.5 shadow-[0_12px_40px_rgba(25,31,40,0.10)]">
          {[...history].reverse().map((h) => (
            <button
              key={h.no}
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between gap-3 rounded-[10px] p-2.5 text-left hover:bg-[#F9FAFB]"
            >
              <span className="flex flex-col gap-[3px]">
                <span className="text-[15px] font-bold tracking-[-0.02em] text-[#191F28]">{h.period}</span>
                <span className="text-[13px] tabular-nums text-[#8B95A1]">
                  {h.no} · {h.span}
                </span>
              </span>
              <span className="text-[13px] font-bold text-[#6B7684]">{h.current ? '현재' : h.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCards() {
  const items = [
    { label: '협약물량', value: contract.volume, big: true },
    { label: '협약 보조금', value: contract.subsidy, big: true },
    { label: '협약 기간', value: contract.period, big: false },
    { label: '협약번호', value: contract.no, big: false },
  ];
  return (
    <section className="grid grid-cols-4 gap-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-[18px] bg-white px-6 py-[22px]">
          <div className="text-[15px] font-semibold text-[#6B7684]">{i.label}</div>
          <div
            className={`mt-2.5 font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28] ${
              i.big ? 'text-[26px]' : 'text-xl'
            }`}
          >
            {i.value}
          </div>
        </div>
      ))}
    </section>
  );
}

function AchievementCard() {
  const a = achievement;
  const stats = [
    { label: '잔여 기간', value: a.remainWeeks, warn: false },
    { label: '부족 물량', value: a.shortTons, warn: true },
    { label: '주당 필요', value: a.weeklyNeed, warn: false },
  ];
  return (
    <section className="rounded-[20px] bg-white px-8 pb-[26px] pt-[30px]">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2.5">
          <span className="text-[15px] font-semibold text-[#6B7684]">협약물량 달성률</span>
          <span className="text-xl font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
            실적물량 {a.actualTons} <span className="text-[#B0B8C1]">/ 협약물량 {a.contractTons}</span>
          </span>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-baseline gap-3">
            <span className="rounded-full bg-[#FFF4E0] px-3 py-1.5 text-sm font-bold text-[#B45309]">
              {a.gapLabel}
            </span>
            <span className="text-[68px] font-extrabold leading-none tabular-nums tracking-[-0.05em] text-[#B45309]">
              {a.rate}%
            </span>
          </div>
          <span className="text-sm tabular-nums text-[#8B95A1]">{a.elapsedLabel}</span>
        </div>
      </div>

      <div className="relative mt-[26px] pb-[34px]">
        <span className="block h-[18px] overflow-hidden rounded-full bg-[#F2F4F6]">
          <span className="block h-[18px] rounded-full bg-[#F59E0B]" style={{ width: `${a.rate}%` }} />
        </span>
        <span
          className="absolute top-0 h-[18px] w-0.5 -translate-x-1/2 bg-[#191F28]"
          style={{ left: `${a.targetRate}%` }}
        />
        <span
          className="absolute top-[23px] -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-[#191F28] px-[9px] py-1 text-xs font-bold text-white"
          style={{ left: `${a.targetRate}%` }}
        >
          지금 도달해야 할 지점 {a.targetRate}%
        </span>
      </div>

      <div className="mt-1 grid grid-cols-3 border-t border-[#F2F4F6] pt-5">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-col gap-2 ${i ? 'border-l border-[#F2F4F6] pl-7' : ''}`}
          >
            <span className="text-sm text-[#8B95A1]">{s.label}</span>
            <span
              className={`text-2xl font-extrabold tabular-nums tracking-[-0.03em] ${
                s.warn ? 'text-[#B45309]' : 'text-[#191F28]'
              }`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShortfallAlert({ onFill }: { onFill?: () => void }) {
  const s = shortfallAlert;
  return (
    <section className="flex items-center gap-6 rounded-[20px] bg-[#FFF4E0] px-7 py-6">
      <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#F59E0B] text-[15px] font-extrabold text-white">
        !
      </span>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-lg font-extrabold tracking-[-0.025em] text-[#B45309]">{s.title}</span>
        <span className="text-[15px] leading-relaxed text-[#92400E]">{s.body}</span>
      </div>

      <div className="flex flex-col gap-1 pr-2 text-right">
        <span className="text-[13px] text-[#92400E]">{s.sideLabel}</span>
        <span className="text-[17px] font-extrabold tabular-nums tracking-[-0.02em] text-[#B45309]">
          {s.sideValue}
        </span>
      </div>

      <button
        type="button"
        onClick={onFill}
        className="h-14 flex-none rounded-[14px] bg-[#3182F6] px-[26px] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
      >
        {s.cta}
      </button>
    </section>
  );
}

/** 협약 기준(좌) / 현재 실적 기준(우) 분리 — 강조는 색이 아니라 위계로 */
function Recalc() {
  return (
    <section className="grid grid-cols-[1fr_380px] items-stretch gap-4">
      <div className="rounded-[20px] bg-white px-7 py-[26px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">확정 보조금 재계산</span>
          <span className="text-sm text-[#8B95A1]">{recalcResult.formulaNote}</span>
        </div>

        <div className="mt-6 grid grid-cols-[200px_1fr]">
          <span className="py-3.5 text-[13px] font-bold text-[#B0B8C1]">구분</span>
          <span className="py-3.5 text-right text-[13px] font-bold text-[#B0B8C1]">협약 기준</span>

          {recalcRows.map((r) => (
            <Fragment key={r.label}>
              <span className="border-t border-[#F2F4F6] py-3.5 text-[15px] text-[#4E5968]">{r.label}</span>
              <span className="flex items-center justify-end gap-2 border-t border-[#F2F4F6] py-3.5">
                <span className="text-[17px] font-bold tabular-nums tracking-[-0.02em] text-[#6B7684]">
                  {r.contract}
                </span>
                {r.adopted && (
                  <span className="rounded-md bg-[#F2F4F6] px-2 py-[3px] text-[11px] font-bold text-[#6B7684]">
                    채택
                  </span>
                )}
              </span>
            </Fragment>
          ))}

          <span className="border-t border-[#E5E8EB] pt-[18px] text-base font-bold text-[#4E5968]">
            협약 기준 {recalcResult.label}
          </span>
          <span className="border-t border-[#E5E8EB] pt-[18px] text-right text-[22px] font-extrabold tabular-nums tracking-[-0.03em] text-[#6B7684]">
            {recalcResult.contract}
          </span>
        </div>
      </div>

      <div className="flex flex-col rounded-[20px] border-t-[3px] border-[#191F28] bg-white px-7 pb-[26px]">
        <div className="flex items-center justify-between gap-2.5 pt-6">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">현재 실적 기준</span>
          <span className="text-[13px] tabular-nums text-[#8B95A1]">{recalcResult.asOfLabel}</span>
        </div>

        <div className="mt-[18px] flex flex-col">
          {recalcRows.map((r) => (
            <span
              key={r.label}
              className="flex items-center justify-between gap-3 border-t border-[#F2F4F6] py-3"
            >
              <span className="text-[15px] text-[#4E5968]">{r.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className={`text-[17px] tabular-nums tracking-[-0.02em] text-[#191F28] ${
                    r.adopted ? 'font-extrabold' : 'font-bold'
                  }`}
                >
                  {r.actual}
                </span>
                {r.adopted && (
                  <span className="rounded-md bg-[#191F28] px-2 py-[3px] text-[11px] font-bold text-white">채택</span>
                )}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2.5 border-t-2 border-[#191F28] pt-[18px]">
          <span className="text-[15px] font-bold text-[#191F28]">{recalcResult.label}</span>
          <span className="flex items-baseline justify-between gap-2.5">
            <span className="text-[32px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {recalcResult.actual}
            </span>
            <span className="flex-none rounded-lg bg-[#FFF4E0] px-2.5 py-[5px] text-sm font-bold tabular-nums text-[#B45309]">
              {recalcResult.diff}
            </span>
          </span>
          <span className="text-[13px] text-[#8B95A1]">{recalcResult.reductionNote}</span>
        </div>
      </div>
    </section>
  );
}

function History() {
  return (
    <section className="rounded-[20px] bg-white px-7 pb-5 pt-[26px]">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">정산 히스토리</span>
          <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
            {historySummary}
          </span>
        </div>
        <span className="text-sm text-[#8B95A1]">기간별 확정 보조금 · 감액 이력</span>
      </div>

      <div className={`mt-[22px] grid ${HISTORY_COLS} gap-3 px-1 pb-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
        <span>정산 기간</span>
        <span className="text-right">협약물량</span>
        <span className="text-right">실적물량</span>
        <span className="text-right">확정 보조금</span>
        <span className="text-right">감액</span>
        <span className="text-right">상태</span>
      </div>

      {history.map((h) => (
        <div
          key={h.no}
          className={[
            `grid ${HISTORY_COLS} items-center gap-3 border-t border-[#F2F4F6]`,
            h.current
              ? '-ml-2 rounded-r-xl border-l-[3px] border-l-[#3182F6] bg-[#F9FAFB] py-4 pl-3 pr-1'
              : 'px-1 py-4',
          ].join(' ')}
        >
          <span className="flex flex-col gap-[3px]">
            <span className="flex items-center gap-2">
              <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{h.period}</span>
              {h.current && (
                <span className="rounded-md bg-[#E8F3FF] px-2 py-[3px] text-xs font-bold text-[#1B64DA]">현재</span>
              )}
            </span>
            <span className="text-[13px] tabular-nums text-[#8B95A1]">
              {h.no} · {h.span}
            </span>
          </span>

          <span className="text-right text-[15px] tabular-nums text-[#6B7684]">{h.contractTons}</span>
          <span className="text-right text-[15px] font-bold tabular-nums text-[#191F28]">{h.actualTons}</span>
          <span className="text-right text-base font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
            {h.subsidy}
          </span>

          <span className="justify-self-end">
            {h.reduction === '없음' ? (
              <span className="text-[15px] text-[#B0B8C1]">없음</span>
            ) : (
              <Badge tone="warnDeep">{h.reduction}</Badge>
            )}
          </span>

          <span className="justify-self-end">
            <Badge tone={h.tone === 'success' ? 'ok' : 'warn'}>{h.status}</Badge>
          </span>
        </div>
      ))}
    </section>
  );
}

function Trips() {
  return (
    <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
      <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">실적 운송 내역</span>
          <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold tabular-nums text-[#6B7684]">
            {tripSummary}
          </span>
        </div>
        <span className="text-sm text-[#8B95A1]">증빙 미비 1건</span>
      </div>

      <div className={`grid ${TRIP_COLS} gap-2.5 px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
        <span>회차</span>
        <span>운송일</span>
        <span>구간</span>
        <span>품목</span>
        <span className="text-right">물량</span>
        <span>운송장번호</span>
        <span className="text-right">증빙 상태</span>
      </div>

      {tripRows.map((t) => {
        const missing = t.proof === 'missing';
        return (
          <div
            key={t.waybill}
            className={[
              `grid ${TRIP_COLS} items-center gap-2.5 border-t border-[#F2F4F6] py-[15px]`,
              missing ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#F59E0B] bg-[#FFFBF2] px-5' : 'px-5',
            ].join(' ')}
          >
            <span className="text-[15px] font-bold tabular-nums text-[#191F28]">{t.no}</span>
            <span className="text-[15px] tabular-nums text-[#4E5968]">{t.date}</span>
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#191F28]">{t.route}</span>
            <span className="text-[15px] text-[#6B7684]">{t.item}</span>
            <span className="text-right text-[15px] font-semibold tabular-nums text-[#191F28]">{t.tons}</span>
            <span className="text-sm tabular-nums text-[#8B95A1]">{t.waybill}</span>
            <span className="justify-self-end">
              <Badge tone={missing ? 'warn' : 'ok'}>{missing ? '증빙 미비' : '증빙 완료'}</Badge>
            </span>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-2.5 border-t border-[#F2F4F6] px-5 py-[15px]">
        <span className="text-[15px] text-[#6B7684]">{tripMore.label}</span>
        <span className="text-[15px] font-semibold tabular-nums text-[#191F28]">{tripMore.tons}</span>
      </div>
    </div>
  );
}

function DocChecklist({ onUpload }: { onUpload?: (name: string) => void }) {
  return (
    <div className="rounded-[20px] bg-white p-6">
      <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">증빙 서류</span>

      <div className="mt-4 flex flex-col">
        {docChecklist.map((d) => (
          <div key={d.name} className="flex flex-col gap-[9px] border-t border-[#F2F4F6] py-3.5">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <span
                  className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-extrabold ${
                    d.ok ? 'bg-[#EAF8F1] text-[#12A87A]' : 'bg-[#FFF4E0] text-[#C77700]'
                  }`}
                >
                  {d.ok ? '✓' : '!'}
                </span>
                <span className={`text-[15px] ${d.ok ? 'text-[#4E5968]' : 'font-semibold text-[#191F28]'}`}>
                  {d.name}
                </span>
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${d.ok ? 'text-[#12A87A]' : 'text-[#C77700]'}`}
              >
                {d.status}
              </span>
            </span>

            {d.file ? (
              <span className="ml-[30px] flex items-center gap-2 rounded-lg border border-[#E5E8EB] bg-[#F9FAFB] px-2.5 py-[7px]">
                <span className="text-xs text-[#8B95A1]">
                  {(d.file.name.split('.').pop() ?? '').toUpperCase()}
                </span>
                <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#333D4B]">
                  {d.file.name}
                </span>
                <span className="ml-auto flex-none text-xs tabular-nums text-[#8B95A1]">{d.file.date}</span>
              </span>
            ) : (
              <span className="ml-[30px] flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onUpload?.(d.name)}
                  className="h-[34px] flex-none rounded-lg border border-[#D1D6DB] bg-white px-3.5 text-[13px] font-bold text-[#333D4B] transition-colors hover:bg-[#F9FAFB]"
                >
                  파일 업로드
                </button>
                <span className="text-xs tabular-nums text-[#8B95A1]">4회차 · KRC-1204-04</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportAction() {
  const blocked = docChecklist.some((d) => !d.ok);
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
      <button
        type="button"
        disabled={blocked}
        className={`h-14 rounded-[14px] text-[17px] font-bold transition-colors ${
          blocked
            ? 'cursor-not-allowed bg-[#F2F4F6] text-[#B0B8C1]'
            : 'bg-[#3182F6] text-white hover:bg-[#1B64DA]'
        }`}
      >
        정산 보고서 생성
      </button>

      {blocked && (
        <p className="flex items-center gap-[7px] text-sm text-[#C77700]">
          <span className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#FFF4E0] text-[10px] font-extrabold">
            !
          </span>
          {reportBlockedNote}
        </p>
      )}
    </div>
  );
}

interface SettlementScreenProps {
  onNavigate?: (to: string) => void;
  onUpload?: (name: string) => void;
}

/** 07 — 정산. 협약물량 대비 달성률이 주인공 */
export function SettlementScreen({ onNavigate, onUpload }: SettlementScreenProps) {
  return (
    <AppLayout active="settlement">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <PeriodSelect />
            <span className="text-sm text-[#6B7684]">{header.subtitle}</span>
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">전환교통 협약 정산</h1>
          <p className="text-base text-[#6B7684]">
            협약물량을 채운 만큼만 보조금이 지급됩니다. 실적 기준으로 계속 재계산됩니다.
          </p>
        </div>
        <span className="rounded-full bg-[#E8F3FF] px-[13px] py-[7px] text-sm font-bold text-[#1B64DA]">
          {contract.status}
        </span>
      </header>

      <SummaryCards />
      <AchievementCard />
      <ShortfallAlert onFill={() => onNavigate?.('/freight/new')} />
      <Recalc />
      <History />

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <Trips />
        <div className="flex flex-col gap-4">
          <DocChecklist onUpload={onUpload} />
          <ReportAction />
        </div>
      </section>
    </AppLayout>
  );
}
