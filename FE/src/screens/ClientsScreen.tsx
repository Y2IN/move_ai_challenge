'use client';

import { useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton, SkeletonGrid } from '../components/AsyncSection';
import { LoadBar } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';
import { useAccount } from '../lib/account';
import {
  STATUS_STYLE,
  fetchClients,
  renewalOrder,
  type ClientRow,
  type ClientsResponse,
} from '../lib/clients';
import { formatCo2, formatNumber, formatPct } from '../lib/format';
import { useAsync } from '../lib/use-async';

const COLS = 'grid grid-cols-[136px_1fr_112px_112px_140px_104px_104px] gap-2.5';

/**
 * 코레일 — 화주 · 영업. 미달 위험 화주를 위로 올린다.
 *
 * 이행률·상태·재계약 D-day 는 **서버가 계산해서 보낸다**(`/api/korail/clients`).
 * 화면에서 다시 계산하면 같은 규칙이 두 군데 생기고, 한쪽만 고치는 순간 갈라진다.
 * 정렬도 서버가 해 둔 순서를 그대로 쓴다.
 */
export function ClientsScreen({ onExport }: { onExport?: () => void }) {
  const account = useAccount('korail');
  const clients = useAsync<ClientsResponse>(useCallback(() => fetchClients(), []));

  return (
    <AppLayout active="clients" role="korail" account={account}>
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">화주 · 영업</h1>
        <p className="text-base text-[#6B7684]">
          합적에 참여한 화주별 협약 이행을 관리합니다. 미달 위험 화주와 재계약 대상을 먼저 확인하세요.
        </p>
      </header>

      <AsyncSection state={clients.state} onRetry={clients.reload} skeleton={<SkeletonGrid count={4} />}>
        {(data) => (
          <section className="grid grid-cols-4 gap-4">
            {data.stats.map((s) => (
              <StatCard
                key={s.key}
                stat={{
                  label: s.label,
                  value: `${formatNumber(s.value)}개사`,
                  delta: s.note,
                  deltaTone: 'flat',
                }}
              />
            ))}
          </section>
        )}
      </AsyncSection>

      <AsyncSection state={clients.state} onRetry={clients.reload} skeleton={<CardSkeleton height={420} />}>
        {(data) => {
          const riskCount = data.items.filter((r) => r.status === '미달 위험').length;

          return (
            <section className="grid grid-cols-[1fr_360px] items-start gap-4">
              <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
                <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">
                      화주별 협약 이행
                    </span>
                    <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                      {data.items.length}개사
                    </span>
                    {riskCount > 0 && (
                      <span className="rounded-lg bg-[#FFF4E0] px-2.5 py-[5px] text-[13px] font-bold text-[#C77700]">
                        미달 위험 {riskCount}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#8B95A1]">
                    {data.period.label} · 미달 위험 우선
                  </span>
                </div>

                <div className={`${COLS} px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
                  <span>화주</span>
                  <span>주 노선</span>
                  <span className="text-right">협약물량</span>
                  <span className="text-right">실적물량</span>
                  <span>이행률</span>
                  <span className="text-right">공차 기여</span>
                  <span className="text-right">상태</span>
                </div>

                {data.items.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[15px] text-[#8B95A1]">
                    이 기간에 협약 실적이 있는 화주가 없습니다.
                  </div>
                ) : (
                  data.items.map((r) => <ClientLine key={r.id} row={r} riskRate={data.riskRate} />)
                )}
              </div>

              <SalesPanel data={data} onExport={onExport} />
            </section>
          );
        }}
      </AsyncSection>
    </AppLayout>
  );
}

function ClientLine({ row, riskRate }: { row: ClientRow; riskRate: number }) {
  const risk = row.status === '미달 위험';

  return (
    <div
      className={[
        COLS,
        'items-center border-t border-[#F2F4F6] px-5 py-4',
        risk ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#F59E0B] bg-[#FFFBF2]' : '',
      ].join(' ')}
    >
      <span className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap text-[17px] font-bold tracking-[-0.02em] text-[#191F28]">
          {row.name}
        </span>
        <span className="whitespace-nowrap text-[13px] text-[#B0B8C1]">{row.industry}</span>
      </span>

      <span className="whitespace-nowrap text-[15px] text-[#6B7684]">{row.route ?? '실적 없음'}</span>

      <span className="text-right text-[15px] tabular-nums text-[#8B95A1]">
        {formatNumber(row.contractTon, 1)}t
      </span>

      <span className="text-right text-[15px] font-semibold tabular-nums text-[#4E5968]">
        {formatNumber(row.actualTon, 1)}t
      </span>

      {/* 이행률은 서버가 계산한 값. LoadBar 가 % 단위를 받으므로 표기만 바꾼다 */}
      <LoadBar load={Math.round(row.rate * 100)} />

      <span className="text-right text-[15px] font-semibold tabular-nums text-[#4E5968]">
        {row.tripCount}편성
      </span>

      <span
        className={`justify-self-end whitespace-nowrap rounded-lg px-2.5 py-[5px] text-[13px] font-bold ${
          STATUS_STYLE[row.status]
        }`}
        title={risk ? `이행률 ${formatPct(riskRate)} 미만` : undefined}
      >
        {row.status}
      </span>
    </div>
  );
}

/** 우측 영업 액션. 재계약 임박·감축 기여가 곧 협상 카드가 된다. */
function SalesPanel({ data, onExport }: { data: ClientsResponse; onExport?: () => void }) {
  const renewals = renewalOrder(data.items);
  const totalReduced = data.items.reduce((sum, i) => sum + i.reducedCo2Ton, 0);
  const disclosure = data.items.filter((i) => i.esgDisclosureRequired);

  return (
    <aside className="flex flex-col gap-4 rounded-[20px] bg-white p-[26px]">
      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">영업 액션</span>

      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-[#8B95A1]">재계약 임박</span>

        {renewals.length ? (
          renewals.map((r) => (
            <div key={r.id} className="rounded-[14px] bg-[#F9FAFB] px-4 py-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold tracking-[-0.02em] text-[#191F28]">{r.name}</span>
                <span className="text-sm font-bold tabular-nums text-[#3182F6]">D-{r.renewalInDays}</span>
              </div>
              <div className="mt-1 text-[13px] tabular-nums text-[#8B95A1]">
                이행률 {formatPct(r.rate)} ·{' '}
                {r.status === '미달 위험' ? '물량 재조정 필요' : '증액 제안 가능'}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#8B95A1]">기한이 임박한 협약이 없습니다.</p>
        )}
      </div>

      {/*
        ESG 공시 의무가 있는 화주에게는 감축량 자체가 협상 카드입니다.
        원장에서 나온 실제 감축분이라 그대로 제시할 수 있습니다.
      */}
      <div className="rounded-[14px] bg-[#F5F9FF] px-4 py-4">
        <div className="text-[13px] font-bold text-[#1B64DA]">화주에게 넘긴 감축 실적</div>
        <div className="mt-2 text-[28px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
          {formatCo2(totalReduced)}
        </div>
        <p className="mt-2 text-[13px] leading-[1.65] text-[#6B7684]">
          이 중 {disclosure.length}개사는 ESG 공시 의무 대상입니다. 감축 실적을 Scope 3 근거로 쓸 수 있어
          재계약 협상에서 가장 강한 카드입니다.
        </p>
      </div>

      <button
        type="button"
        onClick={onExport}
        className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
      >
        영업 리스트 내보내기
      </button>
    </aside>
  );
}
