'use client';

import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react';
import { SUBSIDY } from '@railhub/be/constants';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton } from '../components/AsyncSection';
import { formatDocDate, formatKrw, formatNumber, formatPct } from '../lib/format';
import {
  elapsedLabel,
  fetchSettlement,
  isBehind,
  remainLabel,
  settlementReportUrl,
  uploadSettlementDocument,
  type AchievementView,
  type ContractPerformance,
  type DocumentView,
  type RecalcView,
  type SettlementResponse,
  type TripRow,
} from '../lib/settlement';
import { useAsync } from '../lib/use-async';

const TRIP_COLS = 'grid-cols-[74px_108px_1fr_118px_84px_150px_96px]';
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

const ton = (n: number) => `${formatNumber(n, 1)}톤`;
const span = (from: string, to: string) => `${formatDocDate(from)} ~ ${formatDocDate(to)}`;

interface SettlementScreenProps {
  onNavigate?: (to: string) => void;
  onUpload?: (name: string) => void;
}

/**
 * 07 — 정산. 협약물량 대비 달성률이 주인공.
 *
 * 이행률·경과율·부족 물량·보조금 재산정은 **전부 서버 계산**입니다
 * (`/api/settlement`). 특히 min(A, B) 는 신청서(#31)·편익(#27)과 같은 함수를
 * 쓰므로 세 화면의 금액이 갈라질 수 없습니다 — 화면에서 다시 곱하지 마세요.
 */
export function SettlementScreen({ onNavigate }: SettlementScreenProps) {
  // 협약을 고르면 그 협약으로 정산을 다시 그립니다 (예전에는 드롭다운이 닫히기만 했습니다).
  const [contractNo, setContractNo] = useState<string | null>(null);
  const settlement = useAsync<SettlementResponse>(
    useCallback(() => fetchSettlement(contractNo), [contractNo]),
  );

  return (
    <AppLayout active="settlement">
      <AsyncSection
        state={settlement.state}
        onRetry={settlement.reload}
        skeleton={<CardSkeleton height={520} />}
      >
        {(data) => (
          <SettlementBody
            data={data}
            onNavigate={onNavigate}
            onSelectContract={setContractNo}
            onUploaded={settlement.reload}
          />
        )}
      </AsyncSection>
    </AppLayout>
  );
}

function SettlementBody({
  data,
  onNavigate,
  onSelectContract,
  onUploaded,
}: {
  data: SettlementResponse;
  onNavigate?: (to: string) => void;
  onSelectContract: (no: string) => void;
  onUploaded: () => void;
}) {
  const { contract, achievement, recalc, history, trips, documents } = data;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <PeriodSelect current={contract.no} history={history} onSelect={onSelectContract} />
            <span className="text-sm text-[#6B7684]">협약 전체 대비 현재까지 실적</span>
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

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: '협약물량', value: ton(contract.contractTon), big: true },
          { label: '협약 보조금', value: formatKrw(contract.subsidyKrw), big: true },
          { label: '협약 기간', value: span(contract.periodFrom, contract.periodTo), big: false },
          { label: '협약번호', value: contract.no, big: false },
        ].map((i) => (
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

      <AchievementCard a={achievement} asOf={data.asOf} />

      {/* 뒤처졌을 때만 띄웁니다. 잘 가고 있는데 경고가 떠 있으면 경고를 안 보게 됩니다. */}
      {isBehind(achievement) && (
        <ShortfallAlert a={achievement} onFill={() => onNavigate?.('/freight/new')} />
      )}

      <Recalc recalc={recalc} contractTon={contract.contractTon} actualTon={achievement.actualTon} asOf={data.asOf} />
      <History history={history} />

      <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]">
        <Trips trips={trips} summary={data.tripSummary} />
        <div className="flex flex-col gap-4">
          <DocChecklist documents={documents} onUploaded={onUploaded} />
          <ReportAction blockedReason={data.blockedReason} contractNo={contract.no} />
        </div>
      </section>
    </>
  );
}

/** 협약 기간 선택 — 고르면 그 협약 기준으로 정산을 다시 불러온다. */
function PeriodSelect({
  current,
  history,
  onSelect,
}: {
  current: string;
  history: ContractPerformance[];
  onSelect: (no: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = history.find((h) => h.no === current);

  return (
    <div className="relative max-w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[34px] max-w-full items-center gap-2 rounded-[10px] border border-[#E5E8EB] bg-white px-3 text-sm font-bold tracking-[-0.02em] text-[#191F28]"
      >
        <span className="truncate">
          {now?.name ?? current} ({now ? span(now.periodFrom, now.periodTo) : ''})
        </span>
        <span className="text-[11px] text-[#8B95A1]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-20 w-[360px] max-w-[calc(100vw-48px)] rounded-[14px] border border-[#E5E8EB] bg-white p-1.5 shadow-[0_12px_40px_rgba(25,31,40,0.10)]">
          {[...history].reverse().map((h) => (
            <button
              key={h.no}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect(h.no);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[10px] p-2.5 text-left hover:bg-[#F9FAFB]"
            >
              <span className="flex flex-col gap-[3px]">
                <span className="text-[15px] font-bold tracking-[-0.02em] text-[#191F28]">{h.name}</span>
                <span className="text-[13px] tabular-nums text-[#8B95A1]">
                  {h.no} · {span(h.periodFrom, h.periodTo)}
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

/**
 * 달성률과 **기간 경과율**을 겹쳐 그립니다.
 *
 * "69% 이행" 만으로는 잘 가고 있는지 알 수 없습니다. 기간이 74% 지났다는 걸
 * 나란히 놓아야 뒤처졌다는 게 보입니다. 검은 눈금이 그 지점입니다.
 */
function AchievementCard({ a, asOf }: { a: AchievementView; asOf: string }) {
  const behind = isBehind(a);
  const ratePct = Math.round(a.rate * 100);
  const targetPct = Math.round(a.elapsedRate * 100);
  const tone = behind ? 'text-[#B45309]' : 'text-[#0F7A5A]';

  const stats = [
    { label: '잔여 기간', value: remainLabel(a), warn: false },
    { label: '부족 물량', value: ton(a.shortTon), warn: a.shortTon > 0 },
    { label: '주당 필요', value: a.weeklyNeedTon > 0 ? ton(a.weeklyNeedTon) : '—', warn: false },
  ];

  return (
    <section className="rounded-[20px] bg-white px-5 pb-[26px] pt-[30px] sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2.5">
          <span className="text-[15px] font-semibold text-[#6B7684]">협약물량 달성률</span>
          <span className="text-xl font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
            실적물량 {ton(a.actualTon)}{' '}
            <span className="text-[#B0B8C1]">/ 협약물량 {ton(a.contractTon)}</span>
          </span>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-baseline gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                behind ? 'bg-[#FFF4E0] text-[#B45309]' : 'bg-[#EAF8F1] text-[#0F7A5A]'
              }`}
            >
              목표 대비 {behind ? '' : '+'}
              {Math.round(a.gapRate * 100)}%p
            </span>
            <span
              className={`text-[68px] font-extrabold leading-none tabular-nums tracking-[-0.05em] ${tone}`}
            >
              {ratePct}%
            </span>
          </div>
          <span className="text-sm tabular-nums text-[#8B95A1]">
            {elapsedLabel(a)} · {asOf} 기준
          </span>
        </div>
      </div>

      <div className="relative mt-[26px] pb-2.5 sm:pb-[34px]">
        <span className="block h-[18px] overflow-hidden rounded-full bg-[#F2F4F6]">
          <span
            className={`block h-[18px] rounded-full ${behind ? 'bg-[#F59E0B]' : 'bg-[#15C47E]'}`}
            style={{ width: `${Math.min(ratePct, 100)}%` }}
          />
        </span>
        <span
          className="absolute top-0 h-[18px] w-0.5 -translate-x-1/2 bg-[#191F28]"
          style={{ left: `${Math.min(targetPct, 100)}%` }}
        />
        {/* 좁은 화면에서는 흐름 배치(정적)로 내려 라벨이 카드 밖으로 나가지 않게 한다 */}
        <span
          className="mt-2.5 inline-block whitespace-nowrap rounded-[7px] bg-[#191F28] px-[9px] py-1 text-xs font-bold text-white sm:absolute sm:top-[23px] sm:mt-0 sm:-translate-x-1/2"
          style={{ left: `${Math.min(targetPct, 100)}%` }}
        >
          지금 도달해야 할 지점 {targetPct}%
        </span>
      </div>

      <div className="mt-1 grid grid-cols-1 gap-4 border-t border-[#F2F4F6] pt-5 sm:grid-cols-3 sm:gap-0">
        {stats.map((s, i) => (
          <div key={s.label} className={`flex flex-col gap-2 ${i ? 'sm:border-l sm:border-[#F2F4F6] sm:pl-7' : ''}`}>
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

function ShortfallAlert({ a, onFill }: { a: AchievementView; onFill?: () => void }) {
  return (
    <section className="flex flex-wrap items-center gap-6 rounded-[20px] bg-[#FFF4E0] px-5 py-6 sm:px-7">
      <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#F59E0B] text-[15px] font-extrabold text-white">
        !
      </span>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-lg font-extrabold tracking-[-0.025em] text-[#B45309]">
          현재 추세로는 협약물량 미달이 예상됩니다
        </span>
        <span className="text-[15px] leading-relaxed text-[#92400E]">
          미달 시 보조금은 실적물량 기준으로 감액 지급됩니다. 남은 {remainLabel(a)} 동안 주당{' '}
          {ton(a.weeklyNeedTon)}을 실어야 협약물량을 채웁니다.
        </span>
      </div>

      <div className="flex flex-col gap-1 pr-2 text-right">
        <span className="text-[13px] text-[#92400E]">부족 물량</span>
        <span className="text-[17px] font-extrabold tabular-nums tracking-[-0.02em] text-[#B45309]">
          {ton(a.shortTon)}
        </span>
      </div>

      <button
        type="button"
        onClick={onFill}
        className="h-14 flex-none rounded-[14px] bg-[#3182F6] px-[26px] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
      >
        AI 합적으로 부족 물량 채우기
      </button>
    </section>
  );
}

/**
 * 협약 산정액(좌) / 실적 기준 재산정(우).
 *
 * 협약 쪽 A·B 는 **비워 둡니다.** 협약 당시의 추가비용·편익 내역은 기록으로
 * 남아 있지 않고, 실적 값을 물량 비율로 늘려 적으면 계산한 적 없는 숫자가
 * 계산된 것처럼 보입니다.
 */
function Recalc({
  recalc,
  contractTon,
  actualTon,
  asOf,
}: {
  recalc: RecalcView;
  contractTon: number;
  actualTon: number;
  asOf: string;
}) {
  const rows = [
    { label: '물량', contract: ton(contractTon), actual: ton(actualTon), adopted: false },
    {
      label: '추가비용 (A)',
      contract: '—',
      actual: formatKrw(recalc.additionalCostKrw),
      adopted: recalc.adopted === 'additionalCost',
    },
    {
      // 상한 비율은 고시 값입니다. 화면에 30 을 적어 두면 고시가 바뀔 때 여기가 남습니다.
      label: `편익 × ${Math.round(SUBSIDY.benefitCapRate * 100)}% (B)`,
      contract: '—',
      actual: formatKrw(recalc.benefitCapKrw),
      adopted: recalc.adopted === 'benefitCap',
    },
  ];

  return (
    <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_380px]">
      <div className="rounded-[20px] bg-white px-5 py-[26px] sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">확정 보조금 재계산</span>
          <span className="text-right text-sm leading-relaxed text-[#8B95A1]">{recalc.formulaNote}</span>
        </div>

        <div className="mt-6 grid grid-cols-[140px_1fr] sm:grid-cols-[200px_1fr]">
          <span className="py-3.5 text-[13px] font-bold text-[#B0B8C1]">구분</span>
          <span className="py-3.5 text-right text-[13px] font-bold text-[#B0B8C1]">협약 기준</span>

          {rows.map((r) => (
            <Fragment key={r.label}>
              <span className="border-t border-[#F2F4F6] py-3.5 text-[15px] text-[#4E5968]">{r.label}</span>
              <span className="flex items-center justify-end gap-2 border-t border-[#F2F4F6] py-3.5">
                <span className="text-[17px] font-bold tabular-nums tracking-[-0.02em] text-[#6B7684]">
                  {r.contract}
                </span>
              </span>
            </Fragment>
          ))}

          <span className="border-t border-[#E5E8EB] pt-[18px] text-base font-bold text-[#4E5968]">
            협약 기준 확정 보조금
          </span>
          <span className="border-t border-[#E5E8EB] pt-[18px] text-right text-[22px] font-extrabold tabular-nums tracking-[-0.03em] text-[#6B7684]">
            {formatKrw(recalc.contractSubsidyKrw)}
          </span>
        </div>

        <p className="mt-4 border-t border-[#F2F4F6] pt-4 text-[13px] leading-relaxed text-[#8B95A1]">
          {recalc.note}
        </p>
      </div>

      <div className="flex flex-col rounded-[20px] border-t-[3px] border-[#191F28] bg-white px-5 pb-[26px] sm:px-7">
        <div className="flex items-center justify-between gap-2.5 pt-6">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">현재 실적 기준</span>
          <span className="text-[13px] tabular-nums text-[#8B95A1]">{asOf} 기준</span>
        </div>

        <div className="mt-[18px] flex flex-col">
          {rows.map((r) => (
            <span key={r.label} className="flex items-center justify-between gap-3 border-t border-[#F2F4F6] py-3">
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
          <span className="text-[15px] font-bold text-[#191F28]">확정 보조금</span>
          <span className="flex items-baseline justify-between gap-2.5">
            <span className="text-[32px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {formatKrw(recalc.actualSubsidyKrw)}
            </span>
            <span
              className={`flex-none rounded-lg px-2.5 py-[5px] text-sm font-bold tabular-nums ${
                recalc.diffKrw < 0 ? 'bg-[#FFF4E0] text-[#B45309]' : 'bg-[#EAF8F1] text-[#0F7A5A]'
              }`}
            >
              {recalc.diffKrw < 0 ? '△' : '+'}
              {formatKrw(Math.abs(recalc.diffKrw)).replace('−', '')}
            </span>
          </span>
          <span className="text-[13px] text-[#8B95A1]">
            협약 기준 대비 {formatPct(Math.abs(recalc.reductionRate))}{' '}
            {recalc.reductionRate > 0 ? '감액' : '증액'}
          </span>
        </div>
      </div>
    </section>
  );
}

function History({ history }: { history: ContractPerformance[] }) {
  return (
    <section className="rounded-[20px] bg-white px-5 pb-5 pt-[26px] sm:px-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">정산 히스토리</span>
          <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
            협약 {history.length}건
          </span>
        </div>
        <span className="text-sm text-[#8B95A1]">기간별 확정 보조금 · 감액 이력</span>
      </div>

      {/* 6칸 표 — 좁은 화면은 가로 스크롤. -ml-2/pl-2 는 현재 행 하이라이트(-ml-2)가 잘리지 않게 하는 보정 */}
      <div className="-ml-2 overflow-x-auto pl-2">
        <div className="min-w-[800px]">
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
                h.current ? '-ml-2 rounded-r-xl border-l-[3px] border-l-[#3182F6] bg-[#F9FAFB] py-4 pl-3 pr-1' : 'px-1 py-4',
              ].join(' ')}
            >
              <span className="flex flex-col gap-[3px]">
                <span className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{h.name}</span>
                  {h.current && (
                    <span className="rounded-md bg-[#E8F3FF] px-2 py-[3px] text-xs font-bold text-[#1B64DA]">현재</span>
                  )}
                </span>
                <span className="text-[13px] tabular-nums text-[#8B95A1]">
                  {h.no} · {span(h.periodFrom, h.periodTo)}
                </span>
              </span>

              <span className="text-right text-[15px] tabular-nums text-[#6B7684]">{ton(h.contractTon)}</span>
              <span className="text-right text-[15px] font-bold tabular-nums text-[#191F28]">{ton(h.actualTon)}</span>
              <span className="text-right text-base font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
                {formatKrw(h.actualSubsidyKrw)}
                {h.current && <span className="ml-1 text-[13px] font-semibold text-[#8B95A1]">예상</span>}
              </span>

              <span className="justify-self-end">
                {h.diffKrw >= 0 ? (
                  <span className="text-[15px] text-[#B0B8C1]">없음</span>
                ) : (
                  <Badge tone="warnDeep">△{formatKrw(Math.abs(h.diffKrw)).replace('−', '')}</Badge>
                )}
              </span>

              <span className="justify-self-end">
                <Badge tone={h.status === '전액지급' ? 'ok' : 'warn'}>{h.status}</Badge>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trips({
  trips,
  summary,
}: {
  trips: TripRow[];
  summary: { legCount: number; tripCount: number; totalTon: number };
}) {
  // 명세가 길어서 화면에는 앞쪽만 펴고 나머지는 합계로 접습니다.
  //
  // 접힌 줄은 **서버가 준 전체 합계에서 빼서** 구합니다. `trips` 는 서버가 앞쪽만
  // 잘라 보내므로(협약 한 건이 수천 건입니다) 배열 길이로 세면 "외 12건" 처럼
  // 실제보다 한참 적게 나옵니다.
  const SHOWN = 8;
  const shown = trips.slice(0, SHOWN);
  const shownTon = shown.reduce((sum, t) => sum + t.weightTon, 0);
  const restCount = Math.max(0, summary.legCount - shown.length);
  const restTon = Math.max(0, Math.round((summary.totalTon - shownTon) * 10) / 10);

  return (
    <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3.5 pt-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">실적 운송 내역</span>
          <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold tabular-nums text-[#6B7684]">
            {summary.tripCount}편성 · {summary.legCount}건 · {ton(summary.totalTon)}
          </span>
        </div>
        <span className="text-sm text-[#8B95A1]">운송장은 화주별로 발행됩니다</span>
      </div>

      {/* 7칸 표 — 좁은 화면은 가로 스크롤로 봅니다 */}
      <div className="overflow-x-auto">
        <div className="min-w-[780px]">
          <div className={`grid ${TRIP_COLS} gap-2.5 px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
            <span>회차</span>
            <span>운송일</span>
            <span>구간</span>
            <span>품목</span>
            <span className="text-right">물량</span>
            <span>운송장번호</span>
            <span className="text-right">증빙 상태</span>
          </div>

          {shown.map((t) => (
            <div
              key={t.waybill}
              className={`grid ${TRIP_COLS} items-center gap-2.5 border-t border-[#F2F4F6] px-5 py-[15px]`}
            >
              <span className="text-[15px] font-bold tabular-nums text-[#191F28]">{t.no}회차</span>
              <span className="text-[15px] tabular-nums text-[#4E5968]">{t.date}</span>
              <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#191F28]">{t.route}</span>
              <span className="text-[15px] text-[#6B7684]">{t.category}</span>
              <span className="text-right text-[15px] font-semibold tabular-nums text-[#191F28]">
                {formatNumber(t.weightTon, 1)}t
              </span>
              <span className="truncate text-sm tabular-nums text-[#8B95A1]">{t.waybill}</span>
              <span className="justify-self-end">
                {/* 원장에 올라온 건 = 수송이 끝나고 확정된 실적입니다 */}
                <Badge tone="ok">원장 확정</Badge>
              </span>
            </div>
          ))}

          {restCount > 0 && (
            <div className="flex items-center justify-between gap-2.5 border-t border-[#F2F4F6] px-5 py-[15px]">
              <span className="text-[15px] text-[#6B7684]">외 {formatNumber(restCount)}건</span>
              <span className="text-[15px] font-semibold tabular-nums text-[#191F28]">{ton(restTon)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocChecklist({
  documents,
  onUploaded,
}: {
  documents: DocumentView[];
  onUploaded: () => void;
}) {
  return (
    <div className="rounded-[20px] bg-white p-6">
      <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">증빙 서류</span>

      <div className="mt-4 flex flex-col">
        {documents.map((d) => (
          <div key={d.key} className="flex flex-col gap-[9px] border-t border-[#F2F4F6] py-3.5">
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
              <span className={`text-sm font-bold tabular-nums ${d.ok ? 'text-[#12A87A]' : 'text-[#C77700]'}`}>
                {d.ok ? '완료' : '미제출'}
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
                <span className="ml-auto flex-none text-xs tabular-nums text-[#8B95A1]">
                  {d.file.uploadedAt.slice(5)}
                </span>
              </span>
            ) : (
              <UploadButton doc={d} onUploaded={onUploaded} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 증빙 제출 — 파일을 고르면 **파일명만** 서버에 기록합니다.
 * 본문을 저장하지 않는다는 사실을 화면에도 적어 둡니다 (저장한 척하지 않습니다).
 */
function UploadButton({ doc, onUploaded }: { doc: DocumentView; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="ml-[30px] flex items-center gap-2.5">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            await uploadSettlementDocument(doc.key, file.name);
            onUploaded();
          } catch (err) {
            setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-[34px] flex-none rounded-lg border border-[#D1D6DB] bg-white px-3.5 text-[13px] font-bold text-[#333D4B] transition-colors hover:bg-[#F9FAFB] disabled:opacity-60"
      >
        {busy ? '기록 중…' : '파일 업로드'}
      </button>
      <span className="text-xs text-[#8B95A1]">
        {error ?? '파일명·시각만 기록합니다 (본문 미저장)'}
      </span>
    </span>
  );
}

function ReportAction({
  blockedReason,
  contractNo,
}: {
  blockedReason: string | null;
  contractNo: string;
}) {
  const blocked = blockedReason !== null;
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
      <button
        type="button"
        disabled={blocked}
        onClick={() => window.open(settlementReportUrl(contractNo, 'pdf'), '_blank')}
        className={`h-14 rounded-[14px] text-[17px] font-bold transition-colors ${
          blocked ? 'cursor-not-allowed bg-[#F2F4F6] text-[#B0B8C1]' : 'bg-[#3182F6] text-white hover:bg-[#1B64DA]'
        }`}
      >
        정산 보고서 생성
      </button>
      {!blocked && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.open(settlementReportUrl(contractNo, 'xlsx'), '_blank')}
            className="h-10 flex-1 rounded-[10px] border border-[#E5E8EB] bg-white text-[13px] font-bold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
          >
            엑셀로 내려받기
          </button>
          <button
            type="button"
            onClick={() => window.open(settlementReportUrl(contractNo, 'csv'), '_blank')}
            className="h-10 flex-1 rounded-[10px] border border-[#E5E8EB] bg-white text-[13px] font-bold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
          >
            CSV 원자료
          </button>
        </div>
      )}

      {blocked && (
        <p className="flex items-center gap-[7px] text-sm text-[#C77700]">
          <span className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#FFF4E0] text-[10px] font-extrabold">
            !
          </span>
          {blockedReason}
        </p>
      )}
    </div>
  );
}
