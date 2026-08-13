import { AppLayout } from '../components/AppLayout';
import { DemoDataBadge } from '../components/AsyncSection';
import { LoadBar } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';
import { accounts } from '../mocks/home';
import {
  RISK_RATE,
  STATUS_STYLE,
  clientRows,
  clientStats,
  header,
  salesPanel,
} from '../mocks/clients';

const COLS = 'grid grid-cols-[136px_1fr_112px_112px_140px_104px_104px] gap-2.5';

/** 코레일 — 화주 · 영업. 미달 위험 화주를 위로 올린다 */
export function ClientsScreen({ onExport }: { onExport?: () => void }) {
  const rows = [...clientRows].sort((a, b) => {
    const aRisk = a.status === '미달 위험' ? 0 : 1;
    const bRisk = b.status === '미달 위험' ? 0 : 1;
    if (aRisk !== bRisk) return aRisk - bRisk;
    return a.rate - b.rate;
  });

  const riskCount = rows.filter((r) => r.status === '미달 위험').length;

  return (
    <AppLayout active="clients" role="korail" account={accounts.korail}>
      <header className="flex flex-col gap-2">
        {/* 화주별 협약 이행 API 가 아직 없습니다. 실데이터와 구분되게 표시합니다. */}
        <span className="flex items-center gap-2.5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">{header.title}</h1>
          <DemoDataBadge api="화주 협약 API" />
        </span>
        <p className="text-base text-[#6B7684]">{header.lead}</p>
      </header>

      <section className="grid grid-cols-4 gap-4">
        {clientStats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </section>

      <section className="grid grid-cols-[1fr_360px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
          <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">화주별 협약 이행</span>
              <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                {rows.length}개사
              </span>
              <span className="rounded-lg bg-[#FFF4E0] px-2.5 py-[5px] text-[13px] font-bold text-[#C77700]">
                미달 위험 {riskCount}
              </span>
            </div>
            <span className="text-sm text-[#8B95A1]">미달 위험 우선 · 이행률 낮은 순</span>
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

          {rows.map((r) => {
            const risk = r.rate < RISK_RATE && r.status === '미달 위험';
            return (
              <div
                key={r.id}
                className={[
                  COLS,
                  'items-center border-t border-[#F2F4F6] px-5 py-4',
                  risk ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#F59E0B] bg-[#FFFBF2]' : '',
                ].join(' ')}
              >
                <span className="whitespace-nowrap text-[17px] font-bold tracking-[-0.02em] text-[#191F28]">
                  {r.name}
                </span>

                <span className="whitespace-nowrap text-[15px] text-[#6B7684]">{r.route}</span>

                <span className="text-right text-[15px] tabular-nums text-[#8B95A1]">{r.contractTons}</span>

                <span className="text-right text-[15px] font-semibold tabular-nums text-[#4E5968]">
                  {r.actualTons}
                </span>

                <LoadBar load={r.rate} />

                <span className="text-right text-[15px] font-semibold tabular-nums text-[#4E5968]">
                  {r.contribution}
                </span>

                <span
                  className={`justify-self-end whitespace-nowrap rounded-lg px-2.5 py-[5px] text-[13px] font-bold ${
                    STATUS_STYLE[r.status]
                  }`}
                >
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>

        <aside className="flex flex-col gap-4 rounded-[20px] bg-white p-[26px]">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">{salesPanel.title}</span>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-bold text-[#8B95A1]">{salesPanel.renewalTitle}</span>

            {salesPanel.renewals.map((r) => (
              <div key={r.name} className="rounded-[14px] bg-[#F9FAFB] px-4 py-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-bold tracking-[-0.02em] text-[#191F28]">{r.name}</span>
                  <span className="text-sm font-bold tabular-nums text-[#3182F6]">{r.dday}</span>
                </div>
                <div className="mt-1 text-[13px] tabular-nums text-[#8B95A1]">{r.note}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[14px] bg-[#F5F9FF] px-4 py-4">
            <div className="text-[13px] font-bold text-[#1B64DA]">{salesPanel.newTitle}</div>
            <div className="mt-2 text-[28px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {salesPanel.newSummary}
            </div>
            <p className="mt-2 text-[13px] leading-[1.65] text-[#6B7684]">{salesPanel.newNote}</p>
          </div>

          <button
            type="button"
            onClick={onExport}
            className="h-[52px] rounded-[14px] bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            {salesPanel.cta}
          </button>
        </aside>
      </section>
    </AppLayout>
  );
}
