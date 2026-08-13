import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { MatchRow, MatchRowHeader } from '../components/MatchRow';
import { AnalogyCard, StatCard } from '../components/StatCard';
import {
  accounts,
  benefitTotal,
  breakdown,
  corpRows,
  corpStats,
  freightSaving,
  korailRows,
  korailStats,
  lastReport,
  period,
  subsidyAmount,
  subsidyAmountKrw,
  type Persona,
} from '../mocks/home';

const PERSONAS: { key: Persona; label: string }[] = [
  { key: 'corp', label: '기업 물류 담당자' },
  { key: 'korail', label: '코레일 담당자' },
];

interface HomeScreenProps {
  onNavigate?: (to: string) => void;
}

/** 03 — 로그인 후 홈 대시보드 */
export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [persona, setPersona] = useState<Persona>('corp');
  const [openRow, setOpenRow] = useState<string | null>(null);

  const rows = persona === 'corp' ? corpRows : korailRows;
  const stats = persona === 'corp' ? corpStats : korailStats;
  const account = accounts[persona];

  const toggleRow = (id: string) => setOpenRow((cur) => (cur === id ? null : id));

  return (
    <AppLayout active="home" account={account}>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">
            {account.name}님, 이번 분기 성과입니다
          </h1>
          <p className="mt-2 text-base text-[#6B7684]">{period.basisNote}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate?.('/freight/new')}
            className="h-11 rounded-xl bg-[#3182F6] px-[18px] text-[15px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            화물 등록
          </button>

          <div className="flex gap-1 rounded-xl bg-[#EDEEF0] p-1">
            {PERSONAS.map((p) => {
              const on = p.key === persona;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPersona(p.key);
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
          <div className="rounded-[20px] bg-white p-7">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-[#6B7684]">
                이번 분기 전환교통 보조금 예상액
              </span>
              <span className="rounded-lg bg-[#E8F3FF] px-2.5 py-[5px] text-[13px] font-bold text-[#1B64DA]">
                산정 완료
              </span>
            </div>

            <div className="mt-3.5 text-[42px] font-extrabold tracking-[-0.045em] text-[#191F28]">
              {subsidyAmount}
            </div>
            <div className="mt-1.5 text-[15px] text-[#8B95A1]">
              {subsidyAmountKrw} · 사회환경적 편익의 30% 상한
            </div>

            <div className="mt-[22px] flex flex-col gap-0.5">
              {breakdown.map((b) => (
                <div key={b.label} className="flex items-center justify-between border-t border-[#F2F4F6] py-[11px]">
                  <span className="text-[15px] text-[#4E5968]">{b.label}</span>
                  <span className="text-base font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
                    {b.value}
                  </span>
                </div>
              ))}

              <div className="mt-1.5 flex items-center justify-between border-t-2 border-[#191F28] pb-3 pt-3.5">
                <span className="text-[15px] font-bold text-[#191F28]">사회환경적 편익 계</span>
                <span className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
                  {benefitTotal}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F5F9FF] px-4 py-3.5">
                <span className="text-[15px] font-bold text-[#1B64DA]">× 30% (고시 상한)</span>
                <span className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#1B64DA]">
                  3억 4,200만
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-white px-7 py-[22px]">
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-[#6B7684]">운송비 절감 (보조금과 별개)</span>
              <span className="text-[13px] text-[#B0B8C1]">합적 단가 18% 인하분</span>
            </div>
            <span className="text-2xl font-extrabold tracking-[-0.03em] text-[#191F28]">{freightSaving}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </div>

          <div className="flex gap-4">
            <AnalogyCard tone="green" value="4만 그루" label="소나무 식재 효과" />
            <AnalogyCard value="45대" label="도심 진입 차단 트럭" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[1fr_360px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
          <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">AI 합적 매칭 현황</span>
              <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                {rows.length}건
              </span>
            </div>
            <span className="text-sm text-[#8B95A1]">행을 누르면 상세가 열립니다</span>
          </div>

          <MatchRowHeader />

          {rows.map((row) => (
            <MatchRow
              key={row.id}
              row={row}
              open={openRow === row.id}
              onToggle={toggleRow}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[26px]">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">K-ESG 공시 리포트</span>
          <span className="text-[15px] leading-relaxed text-[#6B7684]">
            이번 분기 지표로 전환교통 보조금 신청서와 K-ESG 지표표를 만듭니다.
          </span>
          <button
            type="button"
            onClick={() => onNavigate?.('/subsidy/new')}
            className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            신청서 만들기
          </button>
          <div className="mt-1 border-t border-[#F2F4F6] pt-4 text-sm leading-relaxed text-[#8B95A1]">
            최근 발행 · {lastReport.title}
            <br />
            {lastReport.meta}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
