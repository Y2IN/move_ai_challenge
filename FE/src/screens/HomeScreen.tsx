'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton, SkeletonGrid } from '../components/AsyncSection';
import { MatchRow, MatchRowHeader } from '../components/MatchRow';
import { AnalogyCard, StatCard } from '../components/StatCard';
import {
  fetchDashboard,
  fetchMatch,
  fetchMatches,
  toMatchDetail,
  toMatchRowData,
  toStatCards,
  type DashboardResponse,
  type MatchRowData,
  type Persona,
} from '../lib/dashboard';
import { formatCompact, formatKrw, formatNumber, formatPeriodLabel, formatWonSign } from '../lib/format';
import { getRole, setRole } from '../lib/role';
import { fetchLatestApplication, type LatestApplication } from '../lib/subsidy';
import { useAsync } from '../lib/use-async';
import { fetchVacancies, type Vacancy } from '../lib/wagons';
import { accounts, basisNote, homeCopy, reportCard } from '../mocks/home';

const PERSONAS: { key: Persona; label: string }[] = [
  { key: 'corp', label: '기업 물류 담당자' },
  { key: 'korail', label: '코레일 담당자' },
];

interface HomeScreenProps {
  onNavigate?: (to: string) => void;
}

/**
 * 03 — 로그인 후 홈 대시보드.
 *
 * 페르소나 토글이 이 화면의 상태이고 그 상태가 조회 조건이라(#7 은 persona 별로
 * 라벨·값이 완전히 다릅니다) 데이터 조회를 화면이 직접 들고 있습니다.
 * 토글을 누르면 대시보드·매칭 목록이 함께 다시 옵니다.
 */
export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [persona, setPersona] = useState<Persona>('corp');
  const [openRow, setOpenRow] = useState<string | null>(null);

  // 로그인 시 고른 역할로 초기 뷰를 맞춘다
  useEffect(() => setPersona(getRole()), []);

  const dashboard = useAsync<DashboardResponse>(useCallback(() => fetchDashboard(persona), [persona]));

  const matches = useAsync<{ rows: MatchRowData[]; total: number }>(
    useCallback(
      () =>
        fetchMatches().then((res) => ({
          rows: res.items.map((m) => toMatchRowData(m, persona)),
          total: res.total,
        })),
      [persona],
    ),
  );

  /**
   * 좌측 두 번째 카드용 보조 조회. 기업은 KPI 안에 값이 있고(운송비 절감),
   * 코레일은 "채울 여지가 있는 공차"라 공차 현황(#18)을 따로 봅니다.
   */
  const vacancies = useAsync<Vacancy[] | null>(
    useCallback(
      () => (persona === 'korail' ? fetchVacancies().then((r) => r.vacancies) : Promise.resolve(null)),
      [persona],
    ),
  );

  /** 우측 하단 "최근 발행" 줄. 초안이 없으면 그렇게 적습니다. */
  const latestDoc = useAsync<LatestApplication | null>(
    useCallback(
      () => (persona === 'corp' ? fetchLatestApplication() : Promise.resolve(null)),
      [persona],
    ),
  );

  const account = accounts[persona];
  const copy = homeCopy[persona];
  const card = reportCard[persona];

  /** 행을 처음 펼칠 때만 상세(#9)를 받아 옵니다. */
  const toggleRow = (id: string) => {
    setOpenRow((cur) => (cur === id ? null : id));
    if (openRow === id) return;

    const row = matches.state.status === 'ready' ? matches.state.data.rows.find((r) => r.id === id) : null;
    if (!row || row.detail) return;

    fetchMatch(id)
      .then((full) =>
        matches.patch((prev) => ({
          ...prev,
          rows: prev.rows.map((r) => (r.id === id ? { ...r, detail: toMatchDetail(full) } : r)),
        })),
      )
      .catch((error: Error) =>
        matches.patch((prev) => ({
          ...prev,
          rows: prev.rows.map((r) =>
            r.id === id ? { ...r, detail: [{ k: '상세', v: error.message }] } : r,
          ),
        })),
      );
  };

  const periodLine =
    dashboard.state.status === 'ready'
      ? `${formatPeriodLabel(dashboard.state.data.period)} · ${basisNote}`
      : basisNote;

  return (
    <AppLayout active="home" role={persona} account={account}>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">
            {account.name}님, 이번 분기 성과입니다
          </h1>
          <p className="mt-2 text-base text-[#6B7684]">{periodLine}</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 코레일은 leftbar에 공차 관리가 있어 헤더 버튼 중복 → 기업(화물 등록)만 노출 */}
          {persona === 'corp' && (
            <button
              type="button"
              onClick={() => onNavigate?.(copy.primaryBtn.to)}
              className="h-11 rounded-xl bg-[#3182F6] px-[18px] text-[15px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              {copy.primaryBtn.label}
            </button>
          )}

          <div className="flex gap-1 rounded-xl bg-[#EDEEF0] p-1">
            {PERSONAS.map((p) => {
              const on = p.key === persona;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPersona(p.key);
                    setRole(p.key); // leftbar가 이후 페이지에서도 같은 역할을 따르도록
                    setOpenRow(null);
                  }}
                  className={[
                    'h-10 rounded-[9px] px-[18px] text-[15px] font-bold transition-colors',
                    on ? 'bg-white text-[#191F28]' : 'text-[#8B95A1]',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-[460px_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <AsyncSection
            state={dashboard.state}
            onRetry={dashboard.reload}
            skeleton={<CardSkeleton height={392} />}
          >
            {(data) => (persona === 'corp' ? <CorpHero data={data} /> : <KorailHero data={data} />)}
          </AsyncSection>

          <AsyncSection state={dashboard.state} onRetry={dashboard.reload} skeleton={<CardSkeleton height={86} />}>
            {(data) => (
              <div className="flex items-center justify-between rounded-[20px] bg-white px-7 py-[22px]">
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold text-[#6B7684]">{copy.savingLabel}</span>
                  <span className="text-[13px] text-[#B0B8C1]">{copy.savingNote}</span>
                </div>
                <span className="text-2xl font-extrabold tracking-[-0.03em] text-[#191F28]">
                  {persona === 'corp'
                    ? (kpi(data, 'costSaving')?.value ?? '—')
                    : openWagonSummary(vacancies.state.status === 'ready' ? vacancies.state.data : null)}
                </span>
              </div>
            )}
          </AsyncSection>
        </div>

        <div className="flex flex-col gap-4">
          <AsyncSection state={dashboard.state} onRetry={dashboard.reload} skeleton={<SkeletonGrid />}>
            {(data) => (
              <div className="grid grid-cols-2 gap-4">
                {toStatCards(data.kpis).map((s) => (
                  <StatCard key={s.label} stat={s} />
                ))}
              </div>
            )}
          </AsyncSection>

          <AsyncSection state={dashboard.state} skeleton={<CardSkeleton height={76} />}>
            {(data) => (
              <div className="flex gap-4">
                <AnalogyCard
                  tone="green"
                  value={`${formatCompact(data.equivalents.pineTrees)} 그루`}
                  label="소나무 식재 효과"
                />
                <AnalogyCard
                  value={`${formatNumber(data.equivalents.trucksBlocked)}대`}
                  label="도심 진입 차단 트럭"
                />
              </div>
            )}
          </AsyncSection>
        </div>
      </section>

      <section className="grid grid-cols-[1fr_360px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
          <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">{copy.matchTitle}</span>
              {matches.state.status === 'ready' && (
                <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                  {matches.state.data.total}건
                </span>
              )}
            </div>
            <span className="text-sm text-[#8B95A1]">행을 누르면 상세가 열립니다</span>
          </div>

          <MatchRowHeader />

          <AsyncSection state={matches.state} onRetry={matches.reload} skeleton={<CardSkeleton height={260} />}>
            {({ rows }) =>
              rows.length ? (
                <>
                  {rows.map((row) => (
                    <MatchRow key={row.id} row={row} open={openRow === row.id} onToggle={toggleRow} />
                  ))}
                </>
              ) : (
                <p className="px-5 py-10 text-center text-[15px] text-[#8B95A1]">
                  아직 편성이 없습니다. 화물을 등록하면 여기에 나타납니다.
                </p>
              )
            }
          </AsyncSection>
        </div>

        <div className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[26px]">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">{card.title}</span>
          <span className="text-[15px] leading-relaxed text-[#6B7684]">{card.body}</span>
          <button
            type="button"
            onClick={() => onNavigate?.(card.to)}
            className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            {card.button}
          </button>

          {persona === 'corp' && (
            <div className="mt-1 border-t border-[#F2F4F6] pt-4 text-sm leading-relaxed text-[#8B95A1]">
              <LatestDocLine state={latestDoc.state.status === 'ready' ? latestDoc.state.data : null} />
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

// ── 좌측 hero ──────────────────────────────────────────────────

const kpi = (data: DashboardResponse, key: string) => data.kpis.find((k) => k.key === key);

/** 기업 — 보조금 예상액이 주인공. 편익 내역과 30% 상한을 함께 편다. */
function CorpHero({ data }: { data: DashboardResponse }) {
  return (
    <div className="rounded-[20px] bg-white p-7">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-[#6B7684]">{homeCopy.corp.heroLabel}</span>
        <span className="rounded-lg bg-[#E8F3FF] px-2.5 py-[5px] text-[13px] font-bold text-[#1B64DA]">산정 완료</span>
      </div>

      <div className="mt-3.5 text-[42px] font-extrabold tracking-[-0.045em] text-[#191F28]">
        {data.subsidyEstimate.label}
      </div>
      <div className="mt-1.5 text-[15px] text-[#8B95A1]">
        {formatWonSign(data.subsidyEstimate.amount)} · 사회환경적 편익의 30% 상한
      </div>

      <div className="mt-[22px] flex flex-col gap-0.5">
        {data.breakdown.map((b) => (
          <div key={b.key} className="flex items-center justify-between border-t border-[#F2F4F6] py-[11px]">
            <span className="text-[15px] text-[#4E5968]">{b.label}</span>
            <span className="text-base font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
              {formatKrw(b.amountKrw)}
            </span>
          </div>
        ))}

        <div className="mt-1.5 flex items-center justify-between border-t-2 border-[#191F28] pb-3 pt-3.5">
          <span className="text-[15px] font-bold text-[#191F28]">사회환경적 편익 계</span>
          <span className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
            {formatKrw(data.totalBenefitKrw)}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#F5F9FF] px-4 py-3.5">
          <span className="text-[15px] font-bold text-[#1B64DA]">× 30% (고시 상한)</span>
          <span className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#1B64DA]">
            {formatKrw(data.subsidyEstimate.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 코레일 — 공차율이 주인공. 채운 화차·신규 화주가 그 아래 근거로 붙는다. */
function KorailHero({ data }: { data: DashboardResponse }) {
  const rate = kpi(data, 'emptyWagonRate');
  const revenue = kpi(data, 'extraRevenue');
  const drivers = [kpi(data, 'filledWagons'), kpi(data, 'newShippers')].filter(Boolean);

  return (
    <div className="rounded-[20px] bg-white p-7">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-[#6B7684]">{homeCopy.korail.heroLabel}</span>
        {rate?.deltaPct != null && rate.deltaPct < 0 && (
          <span className="rounded-lg bg-[#EAF8F1] px-2.5 py-[5px] text-[13px] font-bold text-[#12A87A]">
            {Math.abs(rate.deltaPct)}% 개선
          </span>
        )}
      </div>

      <div className="mt-3.5 text-[42px] font-extrabold tracking-[-0.045em] text-[#191F28]">{rate?.value ?? '—'}</div>
      <div className="mt-1.5 text-[15px] text-[#8B95A1]">{formatPeriodLabel(data.period)} 기준</div>

      <div className="mt-[22px] flex flex-col gap-0.5">
        {drivers.map((d) => (
          <div key={d!.key} className="flex items-center justify-between border-t border-[#F2F4F6] py-[11px]">
            <span className="text-[15px] text-[#4E5968]">{d!.label}</span>
            <span className="text-base font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">{d!.value}</span>
          </div>
        ))}

        <div className="mt-1.5 flex items-center justify-between rounded-xl bg-[#F5F9FF] px-4 py-3.5">
          <span className="text-[15px] font-bold text-[#1B64DA]">{revenue?.label ?? '추가 수익'}</span>
          <span className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#1B64DA]">
            {revenue?.value ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 아직 정원을 못 채운 공차 — 코레일이 "지금 채울 수 있는 것"입니다. */
function openWagonSummary(vacancies: Vacancy[] | null): string {
  if (!vacancies) return '…';
  const open = vacancies.filter((v) => v.phase === 'open' || v.phase === 'negotiate');
  if (!open.length) return '없음';
  const capacity = open.reduce((sum, v) => sum + v.wagon.capacityTon, 0);
  return `${open.length}편성 · ${formatNumber(capacity, 1)}t`;
}

function LatestDocLine({ state }: { state: LatestApplication | null }) {
  if (!state) return <>최근 발행 이력을 확인하는 중…</>;
  if (!state.exists) return <>아직 만든 신청서 초안이 없습니다.</>;
  return (
    <>
      최근 초안 · 문단 {state.paragraphCount ?? 0}개
      <br />
      수정 {state.revisionCount ?? 0}회
    </>
  );
}
