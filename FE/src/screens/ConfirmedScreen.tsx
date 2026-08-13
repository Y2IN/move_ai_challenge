import { AppLayout } from '../components/AppLayout';
import { Banner, Card, CardTitle, WagonRouteCard } from '../components/Card';
import {
  assignmentApproval,
  confirmHeadline,
  confirmedShippers,
  costCompare,
  excludedNote,
  wagon,
} from '../mocks/negotiation';

/** 화물 3건이 화차 1편성으로 모이는 연결선 */
function MergeLines() {
  return (
    <svg viewBox="0 0 132 220" className="h-[220px] w-[132px]" aria-hidden="true">
      <path d="M0 36 C 66 36, 66 110, 132 110" fill="none" stroke="#B0B8C1" strokeWidth="2" />
      <path d="M0 110 L 132 110" fill="none" stroke="#B0B8C1" strokeWidth="2" />
      <path d="M0 184 C 66 184, 66 110, 132 110" fill="none" stroke="#B0B8C1" strokeWidth="2" />
      <circle cx="132" cy="110" r="4" fill="#3182F6" />
    </svg>
  );
}

function WagonBadge() {
  return (
    <div className="rounded-2xl bg-[#0B1220] p-[22px]">
      <div className="text-sm font-semibold text-[#8B95A1]">{wagon.type} 1편성</div>
      <div className="mt-1.5 text-xl font-extrabold tabular-nums tracking-[-0.03em] text-white">{wagon.code}</div>

      <div className="mt-[18px] flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-[#8B95A1]">적재율</span>
        <span className="text-[26px] font-extrabold tabular-nums tracking-[-0.03em] text-white">
          {wagon.finalLoadRate}%
        </span>
      </div>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/[0.14]">
        <span
          className="block h-1.5 rounded-full bg-[#15C47E]"
          style={{ width: `${wagon.finalLoadRate}%` }}
        />
      </span>
    </div>
  );
}

interface ConfirmedScreenProps {
  onNavigate?: (to: string) => void;
}

/** 04e — 조율 완료. 04b와 같은 편성으로 도착한다 */
export function ConfirmedScreen({ onNavigate }: ConfirmedScreenProps) {
  return (
    <AppLayout active="matching">
      <Banner tone="info">{confirmHeadline}</Banner>

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>확정 편성</CardTitle>

            <div className="mt-[18px] grid grid-cols-[1fr_132px_220px] items-center gap-2">
              <div className="flex flex-col gap-2.5">
                {confirmedShippers.map((s) => (
                  <div key={s.name} className="rounded-[14px] border border-[#F2F4F6] bg-[#F9FAFB] px-[18px] py-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{s.name}</span>
                      <span className="text-sm font-bold tabular-nums text-[#12A87A]">{s.saving}</span>
                    </div>
                    <div className="mt-1 text-sm tabular-nums text-[#8B95A1]">{s.detail}</div>
                  </div>
                ))}
              </div>

              <MergeLines />
              <WagonBadge />
            </div>

            <div className="mt-[18px] flex items-center gap-2 border-t border-[#F2F4F6] pt-[14px] text-sm text-[#8B95A1]">
              <span className="text-[13px] font-extrabold text-[#12A87A]">✓</span>
              <span>
                {assignmentApproval.label} ·{' '}
                <b className="font-bold text-[#4E5968]">{assignmentApproval.by}</b> ·{' '}
                <span className="tabular-nums">{assignmentApproval.at}</span>
              </span>
            </div>
          </Card>

          <WagonRouteCard
            route={wagon.route}
            departLabel="출발"
            departAt={wagon.departAt}
            third={{ label: '화차 종류', value: wagon.type }}
            fourth={{ label: '총 물량 · 수송횟수', value: wagon.totalTons }}
          />

          <div className="flex items-center gap-3.5 rounded-[20px] bg-white px-[26px] py-[22px]">
            <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F2F4F6] text-xs font-extrabold text-[#8B95A1]">
              ✕
            </span>
            <span className="text-[15px] text-[#6B7684]">
              <b className="text-[#4E5968]">남광유화 720톤 제외</b> · {excludedNote}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">
              도로 단독 vs 철도 합적
            </span>

            <div className="mt-[18px] grid grid-cols-2 gap-2.5">
              <div className="rounded-[14px] bg-[#F9FAFB] p-4">
                <div className="text-[13px] font-bold text-[#8B95A1]">도로 단독</div>
                <div className="mt-3 text-xs text-[#B0B8C1]">운송비</div>
                <div className="text-lg font-extrabold tracking-[-0.03em] text-[#8B95A1]">
                  {costCompare.road.cost}
                </div>
                <div className="mt-2.5 text-xs text-[#B0B8C1]">탄소 배출</div>
                <div className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#8B95A1]">
                  {costCompare.road.carbon}
                </div>
              </div>

              <div className="rounded-[14px] border border-[#3182F6] bg-[#F5F9FF] p-4">
                <div className="text-[13px] font-bold text-[#1B64DA]">철도 합적</div>
                <div className="mt-3 text-xs text-[#8B95A1]">운송비</div>
                <div className="text-lg font-extrabold tracking-[-0.03em] text-[#191F28]">
                  {costCompare.rail.cost}
                </div>
                <div className="mt-2.5 text-xs text-[#8B95A1]">탄소 배출</div>
                <div className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
                  {costCompare.rail.carbon}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#EAF8F1] px-4 py-3.5">
              <span className="text-[15px] font-bold text-[#12A87A]">평균 운송비 절감</span>
              <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0F7A5A]">
                {costCompare.savingRate}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
            <button
              type="button"
              onClick={() => onNavigate?.('/benefit')}
              className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              편익 확인하기
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('/matching/negotiation')}
              className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB]"
            >
              조율 이력 보기
            </button>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
