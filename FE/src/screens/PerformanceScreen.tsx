'use client';

import { useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, DemoDataBadge, SkeletonGrid } from '../components/AsyncSection';
import { StatCard } from '../components/StatCard';
import { TrendChart } from '../components/TrendChart';
import { fetchDashboard, toStatCards, type StatData } from '../lib/dashboard';
import { useAsync } from '../lib/use-async';
import { accounts } from '../mocks/home';
import { header, perfHistory, perfReport, revenueTrend, trendNotes } from '../mocks/performance';
import { wagonTrend } from '../mocks/wagons';

const COLS = 'grid grid-cols-[120px_1fr_1fr_1.2fr_1fr] gap-2.5';

interface PerformanceScreenProps {
  onPublish?: () => void;
  onOpenLast?: () => void;
}

/**
 * 코레일 — 수송 실적. 공차 운영 성과와 리포트 발행.
 *
 * 상단 KPI 4장만 실데이터(#7)다. 분기별 추이·차트는 아직 시계열 API 가 없어
 * 큐레이션 값을 쓴다 (mocks/performance, mocks/wagons).
 */
export function PerformanceScreen({ onPublish, onOpenLast }: PerformanceScreenProps) {
  const stats = useAsync<StatData[]>(
    useCallback(() => fetchDashboard('korail').then((d) => toStatCards(d.kpis)), []),
  );

  return (
    <AppLayout active="performance" role="korail" account={accounts.korail}>
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">{header.title}</h1>
        <p className="text-base text-[#6B7684]">{header.lead}</p>
      </header>

      <section>
        <AsyncSection
          state={stats.state}
          onRetry={stats.reload}
          skeleton={<SkeletonGrid count={4} height={118} />}
        >
          {(cards) => (
            <div className="grid grid-cols-4 gap-4">
              {cards.map((c) => (
                <StatCard key={c.label} stat={c} />
              ))}
            </div>
          )}
        </AsyncSection>
      </section>

      {/* 분기 시계열 API 가 없어 이 두 차트만 큐레이션 값입니다. 화면에 그렇게 적습니다. */}
      <section className="grid grid-cols-2 gap-4">
        <TrendChart
          title="공차율 추이"
          note={trendNotes.vacancy}
          data={wagonTrend}
          suffix="%"
          demoApi="시계열 API"
        />
        <TrendChart
          title="추가 수익 추이"
          note={trendNotes.revenue}
          data={revenueTrend}
          suffix="만원"
          demoApi="시계열 API"
        />
      </section>

      <section className="grid grid-cols-[1fr_360px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
          <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">분기별 실적</span>
              <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                최근 {perfHistory.length}분기
              </span>
              <DemoDataBadge api="시계열 API" />
            </div>
            <span className="text-sm text-[#8B95A1]">공차 회송 노선 기준</span>
          </div>

          <div className={`${COLS} px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
            <span>분기</span>
            <span className="text-right">공차율</span>
            <span className="text-right">채운 화차</span>
            <span className="text-right">추가 수익</span>
            <span className="text-right">철도 분담률</span>
          </div>

          {perfHistory.map((r) => (
            <div
              key={r.quarter}
              className={[
                COLS,
                'items-center border-t border-[#F2F4F6] px-5 py-4',
                r.current ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#3182F6] bg-[#F5F9FF]' : '',
              ].join(' ')}
            >
              <span
                className={`text-[15px] font-bold tabular-nums ${r.current ? 'text-[#1B64DA]' : 'text-[#191F28]'}`}
              >
                {r.quarter}
              </span>
              <span
                className={`text-right text-[17px] font-bold tabular-nums tracking-[-0.02em] ${
                  r.current ? 'text-[#191F28]' : 'text-[#8B95A1]'
                }`}
              >
                {r.vacancyRate}
              </span>
              <span
                className={`text-right text-[15px] font-semibold tabular-nums ${
                  r.current ? 'text-[#4E5968]' : 'text-[#8B95A1]'
                }`}
              >
                {r.filledWagons}
              </span>
              <span
                className={`text-right text-[17px] font-bold tabular-nums tracking-[-0.02em] ${
                  r.current ? 'text-[#191F28]' : 'text-[#8B95A1]'
                }`}
              >
                {r.revenue}
              </span>
              <span
                className={`text-right text-[15px] font-semibold tabular-nums ${
                  r.current ? 'text-[#12A87A]' : 'text-[#8B95A1]'
                }`}
              >
                {r.modalShare}
              </span>
            </div>
          ))}
        </div>

        <aside className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[26px]">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">{perfReport.title}</span>
          <span className="text-[15px] leading-relaxed text-[#6B7684]">{perfReport.body}</span>

          <button
            type="button"
            onClick={onPublish}
            className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            {perfReport.cta}
          </button>

          <button
            type="button"
            onClick={onOpenLast}
            className="mt-1 border-t border-[#F2F4F6] pt-4 text-left text-sm leading-relaxed text-[#8B95A1]"
          >
            {perfReport.lastTitle}
            <br />
            {perfReport.lastMeta}
          </button>
        </aside>
      </section>
    </AppLayout>
  );
}
