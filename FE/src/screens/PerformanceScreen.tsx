'use client';

import { useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton, SkeletonGrid } from '../components/AsyncSection';
import { StatCard } from '../components/StatCard';
import { TrendChart } from '../components/TrendChart';
import { useAccount } from '../lib/account';
import { fetchDashboard, toStatCards, type StatData } from '../lib/dashboard';
import { formatNumber } from '../lib/format';
import {
  fetchHistory,
  formatMetric,
  toTrend,
  trendNote,
  type HistoryResponse,
} from '../lib/history';
import { useAsync } from '../lib/use-async';

const COLS = 'grid grid-cols-[120px_1fr_1fr_1.2fr_1fr] gap-2.5';

interface PerformanceScreenProps {
  onPublish?: () => void;
  /** 직전 분기 실적 리포트 — 그 분기 id 를 함께 넘긴다 */
  onOpenLast?: (period: string) => void;
}

/**
 * 코레일 — 수송 실적. 공차 운영 성과와 리포트 발행.
 *
 * 상단 KPI 는 #7(이번 분기), 추이·분기별 표는 `/api/dashboard/history` 입니다.
 * 두 엔드포인트가 같은 집계 함수를 부르므로 "카드에는 112톤인데 표에는 108톤"
 * 같은 일이 생기지 않습니다.
 *
 * ⚠️ **공차율·추가 운송 수익 차트가 아니라 적재율·물량 차트입니다.** 수송 실적
 *    원장은 "실린 것"만 담고 "비어서 떠난 화차"는 담지 않아 공차율을 낼 수
 *    없습니다. 없는 값을 만들어 채우는 대신, 원장이 실제로 답할 수 있는 지표를
 *    씁니다.
 */
export function PerformanceScreen({ onPublish, onOpenLast }: PerformanceScreenProps) {
  const account = useAccount('korail');

  const stats = useAsync<StatData[]>(
    useCallback(() => fetchDashboard('korail').then((d) => toStatCards(d.kpis)), []),
  );

  const history = useAsync<HistoryResponse>(useCallback(() => fetchHistory('korail', 4), []));

  return (
    <AppLayout active="performance" role="korail" account={account}>
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">수송 실적</h1>
        <p className="text-base text-[#6B7684]">
          이번 분기 공차 운영 성과입니다. 리포트로 발행할 수 있습니다.
        </p>
      </header>

      <section>
        <AsyncSection state={stats.state} onRetry={stats.reload} skeleton={<SkeletonGrid count={4} height={118} />}>
          {(cards) => (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards.map((c) => (
                <StatCard key={c.label} stat={c} />
              ))}
            </div>
          )}
        </AsyncSection>
      </section>

      <AsyncSection state={history.state} onRetry={history.reload} skeleton={<CardSkeleton height={280} />}>
        {(data) => {
          // 서버가 "차트에 올릴 지표" 두 개를 primary 로 표시해 보냅니다.
          const charts = data.series.filter((s) => s.primary);

          return (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {charts.map((s) => (
                  <TrendChart
                    key={s.key}
                    title={`${s.label} 추이`}
                    note={trendNote(data.items, s.key, s.unit)}
                    data={toTrend(data.items, s.key, s.unit)}
                    suffix={s.unit === 'percent' ? '%' : 't'}
                  />
                ))}
              </section>

              <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
                {/* min-w-0 없으면 그리드 아이템이 표 내용 폭만큼 부풀어 페이지가 가로로 늘어남 */}
                <div className="min-w-0 rounded-[20px] bg-white px-2 pb-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3.5 pt-5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">
                        분기별 실적
                      </span>
                      <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                        최근 {data.items.length}분기
                      </span>
                    </div>
                    <span className="text-sm text-[#8B95A1]">공차 회송 노선 기준</span>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                      <div className={`${COLS} px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
                        <span>분기</span>
                        {data.series.map((s) => (
                          <span key={s.key} className="text-right">
                            {s.label}
                          </span>
                        ))}
                      </div>

                      {data.items.map((row) => (
                        <div
                          key={row.period}
                          className={[
                            COLS,
                            'items-center border-t border-[#F2F4F6] px-5 py-4',
                            row.current ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#3182F6] bg-[#F5F9FF]' : '',
                          ].join(' ')}
                        >
                          <span
                            className={`text-[15px] font-bold tabular-nums ${
                              row.current ? 'text-[#1B64DA]' : 'text-[#191F28]'
                            }`}
                          >
                            {row.label}
                          </span>

                          {data.series.map((s) => (
                            <span
                              key={s.key}
                              className={`text-right text-[15px] font-semibold tabular-nums ${
                                !row.hasData ? 'text-[#D1D6DB]' : row.current ? 'text-[#191F28]' : 'text-[#8B95A1]'
                              }`}
                            >
                              {/* 실적이 없는 분기는 0 을 찍지 않는다 — 0톤 실적과 구분돼야 한다 */}
                              {row.hasData ? formatMetric(row.metrics[s.key], s.unit) : '실적 없음'}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <ReportPanel data={data} onPublish={onPublish} onOpenLast={onOpenLast} />
              </section>
            </>
          );
        }}
      </AsyncSection>
    </AppLayout>
  );
}

function ReportPanel({
  data,
  onPublish,
  onOpenLast,
}: {
  data: HistoryResponse;
  onPublish?: () => void;
  onOpenLast?: (period: string) => void;
}) {
  const withData = data.items.filter((p) => p.hasData);
  const previous = withData.length >= 2 ? withData[withData.length - 2] : null;
  const totalTon = withData.reduce((sum, p) => sum + p.metrics.totalTon, 0);

  return (
    <aside className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[26px]">
      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">수송 실적 리포트</span>
      <span className="text-[15px] leading-relaxed text-[#6B7684]">
        최근 {withData.length}개 분기 실적 {formatNumber(totalTon, 1)}t 을 하나의 문서로 정리합니다.
      </span>

      <button
        type="button"
        onClick={onPublish}
        className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
      >
        수송 실적 리포트 발행
      </button>

      {/* 직전 분기가 곧 "최근 발행분" 자리. 없으면 그렇게 적는다 */}
      <button
        type="button"
        onClick={() => previous && onOpenLast?.(previous.period)}
        disabled={!previous}
        className="mt-1 border-t border-[#F2F4F6] pt-4 text-left text-sm leading-relaxed text-[#8B95A1] disabled:cursor-not-allowed"
      >
        {previous ? (
          <>
            직전 분기 · {previous.label} 실적
            <br />
            {formatNumber(previous.metrics.totalTon, 1)}t · {previous.metrics.tripCount}편성
          </>
        ) : (
          '비교할 직전 분기 실적이 없습니다.'
        )}
      </button>
    </aside>
  );
}
