'use client';

import { useCallback, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton, SkeletonGrid } from '../components/AsyncSection';
import { LoadBar, StatusBadge } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';
import {
  fetchDashboard,
  fetchMatch,
  fetchMatches,
  toMatchDetail,
  toMatchRowData,
  toStatCards,
  type MatchRowData,
  type StatData,
} from '../lib/dashboard';
import { useAsync } from '../lib/use-async';
import { accounts } from '../mocks/home';
import { MIN_LOAD_RATE, fillPanel, header, wagonCapacity, wagonType } from '../mocks/wagons';

// 각 열을 내용이 안 접히는 폭으로 고정하고, 부족하면 카드 안에서 가로 스크롤
// 구간만 남는 폭을 흡수(최소 260px), 나머지는 고정
const COLS =
  'grid grid-cols-[124px_minmax(260px,1fr)_150px_92px_100px_100px_140px_112px_24px] gap-2.5';
const TABLE_MIN_W = 'min-w-[1230px]';

/**
 * detail 배열에서 키로 값 찾기.
 *
 * `detail` 은 행을 펼칠 때 #9 로 받아 오므로 그 전엔 null 이다. 목록 API(#8)에는
 * 출발 시각·잔여 용량이 없어서, 이 두 열은 펼치기 전까지 '…' 로 둔다.
 * 전부 미리 채우려면 행 수만큼 #9 를 호출해야 해서 목록이 그만큼 느려진다.
 */
function pick(row: MatchRowData, keys: string[]) {
  if (!row.detail) return '…';
  for (const k of keys) {
    const hit = row.detail.find((d) => d.k === k);
    if (hit) return hit.v;
  }
  return '-';
}

interface WagonScreenProps {
  onNavigate?: (to: string) => void;
}

/**
 * 코레일 — 공차 관리. 적재 미달 공차를 위로 올린다.
 *
 * 표의 원천은 편성 목록(#8)이다. 공차 현황(#18)은 적재율·수익을 들고 있지 않아
 * 이 표를 채우지 못한다 — 화차 자체의 스펙(정원·형식)만 준다.
 */
export function WagonScreen({ onNavigate }: WagonScreenProps) {
  const [openRow, setOpenRow] = useState<string | null>(null);

  const stats = useAsync<StatData[]>(
    useCallback(() => fetchDashboard('korail').then((d) => toStatCards(d.kpis)), []),
  );

  // 적재율 낮은 순 — 채울 여지가 큰 공차가 위로 온다.
  const matches = useAsync<MatchRowData[]>(
    useCallback(
      () =>
        fetchMatches().then((res) =>
          res.items.map((m) => toMatchRowData(m, 'korail')).sort((a, b) => a.load - b.load),
        ),
      [],
    ),
  );

  /** 행을 처음 펼칠 때만 상세(#9)를 받아 온다. */
  const toggle = (id: string) => {
    setOpenRow((cur) => (cur === id ? null : id));
    if (openRow === id) return;

    const row = matches.state.status === 'ready' ? matches.state.data.find((r) => r.id === id) : null;
    if (!row || row.detail) return;

    fetchMatch(id)
      .then((full) =>
        matches.patch((prev) =>
          prev.map((r) => (r.id === id ? { ...r, detail: toMatchDetail(full) } : r)),
        ),
      )
      .catch((error: Error) =>
        matches.patch((prev) =>
          prev.map((r) => (r.id === id ? { ...r, detail: [{ k: '상세', v: error.message }] } : r)),
        ),
      );
  };

  return (
    <AppLayout active="wagons" role="korail" account={accounts.korail}>
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

      <section className="grid grid-cols-[1fr_360px] items-start gap-4">
        {/* min-w-0 없으면 그리드 아이템이 내용 폭(1230px)만큼 부풀어 페이지가 가로로 늘어남 */}
        <AsyncSection
          state={matches.state}
          onRetry={matches.reload}
          skeleton={<CardSkeleton height={520} />}
        >
          {(rows) => (
          <div className="min-w-0 rounded-[20px] bg-white px-2 pb-3 pt-2">
            <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">공차 목록</span>
                <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                  {rows.length}편성
                </span>
                <span className="rounded-lg bg-[#FFF4E0] px-2.5 py-[5px] text-[13px] font-bold text-[#C77700]">
                  적재 미달 {rows.filter((r) => r.load < MIN_LOAD_RATE).length}
                </span>
              </div>
              <span className="text-sm text-[#8B95A1]">적재율 낮은 순 · 행을 누르면 합적 화주가 열립니다</span>
            </div>

            <div className="overflow-x-auto">
            <div className={TABLE_MIN_W}>
            <div className={`${COLS} px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
              <span>화차번호</span>
              <span>구간</span>
              <span className="text-center">출발 예정</span>
              <span className="text-center">형식</span>
              <span className="text-center">정원</span>
              <span className="text-center">잔여</span>
              <span className="text-center">적재율</span>
              <span className="text-center">예상 수익</span>
              <span />
            </div>

            {rows.map((row) => {
              const short = row.load < MIN_LOAD_RATE;
              const open = openRow === row.id;

              return (
                <div
                  key={row.id}
                  className={[
                    'border-t border-[#F2F4F6]',
                    short ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#F59E0B] bg-[#FFFBF2]' : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => toggle(row.id)}
                    className={`${COLS} w-full items-center px-5 py-4 text-left hover:bg-black/[0.015]`}
                  >
                    <span className="flex flex-col items-start gap-1.5">
                      <StatusBadge tone={row.tone} small />
                      <span className="text-[15px] font-bold tabular-nums text-[#191F28]">{row.wagon}</span>
                    </span>

                    <span className="flex flex-col gap-1">
                      <span className="whitespace-nowrap text-[17px] font-bold tracking-[-0.02em] text-[#191F28]">
                        {row.route}
                      </span>
                      <span className="text-sm text-[#8B95A1]">{row.sub}</span>
                    </span>

                    <span className="text-center text-sm tabular-nums text-[#4E5968]">
                      {pick(row, ['출발', '출발 예정'])}
                    </span>

                    <span className="text-center text-sm text-[#6B7684]">{wagonType[row.wagon] ?? '-'}</span>

                    <span className="text-center text-[15px] tabular-nums text-[#8B95A1]">
                      {wagonCapacity[row.wagon] ?? '-'}
                    </span>

                    <span className="text-center text-[15px] font-semibold tabular-nums text-[#4E5968]">
                      {pick(row, ['잔여 용량', '미배정 용량'])}
                    </span>

                    <div className="text-center">
                      <LoadBar load={row.load} />
                    </div>

                    <span className="text-center text-base font-bold tabular-nums text-[#3182F6]">{row.saving}</span>

                    <span className="text-center text-[15px] text-[#B0B8C1]">{open ? '⌃' : '⌄'}</span>
                  </button>

                  {short && (
                    <div className="flex items-center justify-between gap-4 px-5 pb-4">
                      <span className="text-sm text-[#B45309]">
                        최소 적재 기준 {MIN_LOAD_RATE}%에 미달합니다. 합적으로 채울 수 있습니다.
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate?.('/matching/unmatched')}
                        className="h-10 flex-none rounded-[10px] bg-[#3182F6] px-4 text-sm font-bold text-white transition-colors hover:bg-[#1B64DA]"
                      >
                        합적 화주 찾기
                      </button>
                    </div>
                  )}

                  {open && (
                    <div className="mx-3 mb-4 mt-1.5 grid grid-cols-4 items-start gap-4 rounded-[14px] bg-[#F9FAFB] px-5 pb-6 pt-5">
                      {row.detail ? (
                        row.detail.map((d) => (
                          <div key={d.k} className="flex flex-col gap-1.5">
                            <span className="text-[13px] text-[#8B95A1]">{d.k}</span>
                            <span className="text-base font-bold tracking-[-0.02em] text-[#333D4B]">{d.v}</span>
                          </div>
                        ))
                      ) : (
                        <span className="col-span-4 text-sm text-[#8B95A1]">상세를 불러오는 중…</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            </div>
          </div>
          )}
        </AsyncSection>

        <aside className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[26px]">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">{fillPanel.title}</span>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between rounded-[14px] bg-[#FFFBF2] px-4 py-3.5">
              <span className="text-sm font-semibold text-[#B45309]">{fillPanel.shortCount}</span>
              <span className="text-[15px] font-bold tabular-nums text-[#B45309]">{fillPanel.shortCapacity}</span>
            </div>

            <div className="rounded-[14px] bg-[#F5F9FF] px-4 py-4">
              <div className="text-[13px] font-bold text-[#1B64DA]">{fillPanel.potentialLabel}</div>
              <div className="mt-2 text-[28px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
                {fillPanel.potential}
              </div>
            </div>
          </div>

          <p className="text-sm leading-[1.65] text-[#6B7684]">{fillPanel.body}</p>

          <button
            type="button"
            onClick={() => onNavigate?.('/matching/unmatched')}
            className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            {fillPanel.cta}
          </button>
        </aside>
      </section>
    </AppLayout>
  );
}
