import { Fragment } from 'react';
import { AppLayout } from '../components/AppLayout';
import {
  achievement,
  contract,
  docChecklist,
  recalcResult,
  recalcRows,
  reportBlockedNote,
  shortfallAlert,
  tripRows,
  tripSummary,
} from '../mocks/settlement';

const TRIP_COLS = 'grid grid-cols-[74px_108px_1fr_118px_84px_128px_96px] gap-2.5';

function ContractCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-[18px] bg-white px-6 py-[22px]">
      <div className="text-[15px] font-semibold text-[#6B7684]">{label}</div>
      <div
        className={`mt-2.5 font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28] ${
          small ? 'text-xl' : 'text-[26px]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

interface SettlementScreenProps {
  onNavigate?: (to: string) => void;
  onUpload?: () => void;
}

/** 07 — 정산. 협약물량 대비 달성률이 주인공 */
export function SettlementScreen({ onNavigate, onUpload }: SettlementScreenProps) {
  const blocked = docChecklist.some((d) => !d.ok);

  return (
    <AppLayout active="settlement">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">전환교통 협약 정산</h1>
          <p className="mt-2 text-base text-[#6B7684]">
            협약물량을 채운 만큼만 보조금이 지급됩니다. 실적 기준으로 계속 재계산됩니다.
          </p>
        </div>
        <span className="rounded-full bg-[#E8F3FF] px-[13px] py-[7px] text-sm font-bold text-[#1B64DA]">
          {contract.status}
        </span>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <ContractCard label="협약물량" value={contract.volume} />
        <ContractCard label="협약 보조금" value={contract.subsidy} />
        <ContractCard label="협약 기간" value={contract.period} small />
        <ContractCard label="협약번호" value={contract.no} small />
      </section>

      <section className="rounded-[20px] bg-white px-8 pb-[26px] pt-[30px]">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2.5">
            <span className="text-[15px] font-semibold text-[#6B7684]">협약물량 달성률</span>
            <span className="text-xl font-bold tabular-nums tracking-[-0.02em] text-[#4E5968]">
              실적물량 {achievement.actualTons}{' '}
              <span className="text-[#B0B8C1]">/ 협약물량 {achievement.contractTons}</span>
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="rounded-full bg-[#FFF4E0] px-3 py-1.5 text-sm font-bold text-[#B45309]">
              {achievement.gapLabel}
            </span>
            <span className="text-[68px] font-extrabold leading-none tabular-nums tracking-[-0.05em] text-[#B45309]">
              {achievement.rate}%
            </span>
          </div>
        </div>

        <div className="relative mt-[26px] pb-[34px]">
          <span className="block h-[18px] overflow-hidden rounded-full bg-[#F2F4F6]">
            <span
              className="block h-[18px] rounded-full bg-[#F59E0B]"
              style={{ width: `${achievement.rate}%` }}
            />
          </span>

          <span
            className="absolute top-0 h-[18px] w-0.5 -translate-x-1/2 bg-[#191F28]"
            style={{ left: `${achievement.targetRate}%` }}
          />

          <span
            className="absolute top-[23px] flex -translate-x-1/2 flex-col items-center gap-1"
            style={{ left: `${achievement.targetRate}%` }}
          >
            <span className="whitespace-nowrap rounded-[7px] bg-[#191F28] px-[9px] py-1 text-xs font-bold text-white">
              지금 도달해야 할 지점 {achievement.targetRate}%
            </span>
          </span>
        </div>

        <div className="mt-1 grid grid-cols-3 border-t border-[#F2F4F6] pt-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-[#8B95A1]">잔여 기간</span>
            <span className="text-2xl font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
              {achievement.remainWeeks}
            </span>
          </div>
          <div className="flex flex-col gap-2 border-l border-[#F2F4F6] pl-7">
            <span className="text-sm text-[#8B95A1]">부족 물량</span>
            <span className="text-2xl font-extrabold tabular-nums tracking-[-0.03em] text-[#B45309]">
              {achievement.shortTons}
            </span>
          </div>
          <div className="flex flex-col gap-2 border-l border-[#F2F4F6] pl-7">
            <span className="text-sm text-[#8B95A1]">주당 필요</span>
            <span className="text-2xl font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
              {achievement.weeklyNeed}
            </span>
          </div>
        </div>
      </section>

      <section className="flex items-center gap-6 rounded-[20px] bg-[#FFF4E0] px-7 py-6">
        <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#F59E0B] text-[15px] font-extrabold text-white">
          !
        </span>

        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-lg font-extrabold tracking-[-0.025em] text-[#B45309]">{shortfallAlert.title}</span>
          <span className="text-[15px] leading-relaxed text-[#92400E]">{shortfallAlert.body}</span>
        </div>

        <div className="flex flex-col gap-1 pr-2 text-right">
          <span className="text-[13px] text-[#92400E]">{shortfallAlert.sideLabel}</span>
          <span className="text-[17px] font-extrabold tabular-nums tracking-[-0.02em] text-[#B45309]">
            {shortfallAlert.sideValue}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('/freight/new')}
          className="h-14 flex-none rounded-[14px] bg-[#3182F6] px-[26px] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
        >
          {shortfallAlert.cta}
        </button>
      </section>

      <section className="rounded-[20px] bg-white px-7 py-[26px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">확정 보조금 재계산</span>
          <span className="text-sm text-[#8B95A1]">{recalcResult.formulaNote}</span>
        </div>

        <div className="mt-7 grid grid-cols-[200px_1fr_1fr]">
          <span className="py-3.5 text-[13px] font-bold text-[#B0B8C1]">구분</span>
          <span className="px-5 py-3.5 text-right text-[13px] font-bold text-[#B0B8C1]">협약 기준</span>
          <span className="rounded-t-xl bg-[#F5F9FF] px-5 py-3.5 text-right text-[13px] font-bold text-[#1B64DA]">
            현재 실적 기준
          </span>

          {recalcRows.map((r) => (
            <Fragment key={r.label}>
              <span className="border-t border-[#F2F4F6] py-3.5 text-[15px] text-[#4E5968]">{r.label}</span>

              {/* 배지를 앞에 두어 숫자가 항상 오른쪽 끝에서 자릿수로 맞는다 */}
              <span className="flex items-center justify-end gap-2 border-t border-[#F2F4F6] px-5 py-3.5">
                {r.adopted && (
                  <span className="rounded-md bg-[#F2F4F6] px-2 py-[3px] text-[11px] font-bold text-[#6B7684]">
                    채택
                  </span>
                )}
                <span className="text-[17px] font-bold tabular-nums tracking-[-0.02em] text-[#8B95A1]">
                  {r.contract}
                </span>
              </span>

              <span className="flex items-center justify-end gap-2 bg-[#F5F9FF] px-5 py-3.5">
                {r.adopted && (
                  <span className="rounded-md bg-[#3182F6] px-2 py-[3px] text-[11px] font-bold text-white">채택</span>
                )}
                <span className="text-[17px] font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">
                  {r.actual}
                </span>
              </span>
            </Fragment>
          ))}

          <span className="border-t-2 border-[#191F28] py-[18px] text-base font-extrabold text-[#191F28]">
            {recalcResult.label}
          </span>
          <span className="border-t-2 border-[#191F28] px-5 py-[18px] text-right text-[22px] font-extrabold tabular-nums tracking-[-0.03em] text-[#8B95A1]">
            {recalcResult.contract}
          </span>
          <span className="flex items-baseline justify-end gap-3 rounded-b-xl bg-[#F5F9FF] px-5 py-[18px]">
            <span className="rounded-lg bg-[#FFF4E0] px-2.5 py-[5px] text-sm font-bold tabular-nums text-[#B45309]">
              {recalcResult.diff}
            </span>
            <span className="text-[28px] font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {recalcResult.actual}
            </span>
          </span>
        </div>
      </section>

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-2 pb-3 pt-2">
          <div className="flex items-center justify-between px-5 pb-3.5 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">실적 운송 내역</span>
              <span className="rounded-lg bg-[#F2F4F6] px-2.5 py-[5px] text-[13px] font-bold text-[#6B7684]">
                {tripSummary}
              </span>
            </div>
            <span className="text-sm text-[#8B95A1]">증빙 미비 1건</span>
          </div>

          <div className={`${TRIP_COLS} px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
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
                key={t.no}
                className={[
                  TRIP_COLS,
                  'items-center border-t border-[#F2F4F6] px-5 py-[15px]',
                  missing ? 'ml-2 rounded-r-xl border-l-[3px] border-l-[#F59E0B] bg-[#FFFBF2]' : '',
                ].join(' ')}
              >
                <span className="text-[15px] font-bold tabular-nums text-[#191F28]">{t.no}</span>
                <span className="text-[15px] tabular-nums text-[#4E5968]">{t.date}</span>
                <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#191F28]">{t.route}</span>
                <span className="text-[15px] text-[#6B7684]">{t.item}</span>
                <span className="text-right text-[15px] font-semibold tabular-nums text-[#4E5968]">{t.tons}</span>
                <span className="text-sm tabular-nums text-[#8B95A1]">{t.waybill}</span>
                <span
                  className={`justify-self-end rounded-lg px-2.5 py-[5px] text-[13px] font-bold ${
                    missing ? 'bg-[#FFF4E0] text-[#C77700]' : 'bg-[#EAF8F1] text-[#12A87A]'
                  }`}
                >
                  {missing ? '증빙 미비' : '증빙 완료'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">증빙 서류</span>

            <div className="mt-4 flex flex-col">
              {docChecklist.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-3 border-t border-[#F2F4F6] py-[13px]">
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
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onUpload}
              className="mt-[18px] h-12 w-full rounded-xl border border-dashed border-[#D1D6DB] bg-white text-[15px] font-bold text-[#4E5968] transition-colors hover:border-[#3182F6] hover:text-[#3182F6]"
            >
              운송장 사본 업로드
            </button>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
            <button
              type="button"
              disabled={blocked}
              className={[
                'h-14 rounded-[14px] text-[17px] font-bold transition-colors',
                blocked
                  ? 'cursor-not-allowed bg-[#F2F4F6] text-[#B0B8C1]'
                  : 'bg-[#3182F6] text-white hover:bg-[#1B64DA]',
              ].join(' ')}
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
        </div>
      </section>
    </AppLayout>
  );
}
