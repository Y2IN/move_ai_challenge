import { AppLayout } from '../components/AppLayout';
import { AnalogyCard } from '../components/StatCard';
import {
  analogies,
  benefitItems,
  benefitPeriod,
  carbonChart,
  modeRows,
  subsidyFormula,
} from '../mocks/benefit';

function ModeCard({ variant }: { variant: 'road' | 'rail' }) {
  const rail = variant === 'rail';
  return (
    <div className={`rounded-[20px] bg-white p-[26px] ${rail ? 'border border-[#3182F6]' : ''}`}>
      <span className={`text-[15px] font-bold ${rail ? 'text-[#1B64DA]' : 'text-[#8B95A1]'}`}>
        {rail ? '철도 합적' : '도로 단독'}
      </span>

      <div className="mt-[18px] flex flex-col gap-3.5">
        {modeRows.map((row) => {
          const value = rail ? row.rail : row.road;
          const dim = !rail || value === '—';
          return (
            <div key={row.label} className="flex items-baseline justify-between gap-2.5">
              <span className={`text-[15px] ${rail ? 'text-[#6B7684]' : 'text-[#8B95A1]'}`}>{row.label}</span>
              <span className="flex items-center gap-2">
                {rail && row.railBadge && (
                  <span className="rounded-lg bg-[#EAF8F1] px-2.5 py-[5px] text-[13px] font-bold text-[#12A87A]">
                    {row.railBadge}
                  </span>
                )}
                <span
                  className={`text-2xl font-extrabold tabular-nums tracking-[-0.03em] ${
                    dim ? (value === '—' ? 'text-[#D1D6DB]' : 'text-[#8B95A1]') : 'text-[#191F28]'
                  }`}
                >
                  {value}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BenefitScreenProps {
  onNavigate?: (to: string) => void;
}

/** 05 — 편익 대시보드. 도로 vs 철도 → 4대 편익 → 보조금 → 비유 → 그래프 */
export function BenefitScreen({ onNavigate }: BenefitScreenProps) {
  return (
    <AppLayout active="subsidy">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">이번 전환의 편익</h1>
        <p className="text-base text-[#6B7684]">{benefitPeriod}</p>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <ModeCard variant="road" />
        <ModeCard variant="rail" />
      </section>

      <section className="grid grid-cols-4 gap-4">
        {benefitItems.map((b) => (
          <div key={b.name} className="flex flex-col gap-2.5 rounded-[18px] bg-white p-6">
            <span className="text-[15px] font-bold text-[#4E5968]">{b.name}</span>
            <span className="text-sm tabular-nums text-[#8B95A1]">{b.basis}</span>
            <span className="mt-1.5 text-[28px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {b.amount}
            </span>
            <span className="mt-auto pt-2.5 text-xs text-[#B0B8C1]">{b.source}</span>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1fr_300px] items-center gap-6 rounded-[20px] bg-white p-7">
        <div>
          <div className="flex items-baseline justify-between border-b-2 border-[#191F28] pb-3.5">
            <span className="text-[17px] font-bold text-[#191F28]">{subsidyFormula.totalLabel}</span>
            <span className="text-[26px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {subsidyFormula.total}
            </span>
          </div>

          <div className="mt-3.5 flex items-center justify-between rounded-[14px] bg-[#F5F9FF] px-[18px] py-4">
            <span className="text-[17px] font-bold text-[#1B64DA]">{subsidyFormula.rateLabel}</span>
            <span className="text-3xl font-extrabold tabular-nums tracking-[-0.04em] text-[#1B64DA]">
              {subsidyFormula.result}
            </span>
          </div>

          <p className="mt-3.5 text-[13px] leading-[1.7] text-[#8B95A1]">{subsidyFormula.basis}</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('/subsidy/new')}
          className="h-[60px] rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
        >
          신청서 만들기
        </button>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex gap-4">
          <AnalogyCard tone="green" value={analogies.pine.value} label={analogies.pine.label} />
          <AnalogyCard value={analogies.truck.value} label={analogies.truck.label} />
        </div>
        <p className="text-[13px] text-[#8B95A1]">{analogies.note}</p>
      </section>

      <section className="rounded-[20px] bg-white p-[26px]">
        <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">탄소 배출량 비교</span>

        <div className="mt-[22px] flex flex-col gap-[18px]">
          {[carbonChart.road, carbonChart.rail].map((bar, i) => {
            const isRail = i === 1;
            return (
              <div key={bar.label} className="grid grid-cols-[90px_1fr_120px] items-center gap-4">
                <span className={`text-[15px] font-semibold ${isRail ? 'text-[#191F28]' : 'text-[#8B95A1]'}`}>
                  {bar.label}
                </span>
                <span className="block h-7 overflow-hidden rounded-lg bg-[#F2F4F6]">
                  <span
                    className={`block h-7 rounded-lg ${isRail ? 'bg-[#3182F6]' : 'bg-[#D1D6DB]'}`}
                    style={{ width: `${bar.ratio}%` }}
                  />
                </span>
                <span
                  className={`text-right text-lg font-extrabold tabular-nums tracking-[-0.02em] ${
                    isRail ? 'text-[#191F28]' : 'text-[#8B95A1]'
                  }`}
                >
                  {bar.value}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </AppLayout>
  );
}
