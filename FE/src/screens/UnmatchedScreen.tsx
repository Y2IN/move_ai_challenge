import { AppLayout } from '../components/AppLayout';
import { Banner, Card, CardTitle, InfoCell } from '../components/Card';
import { agentNote, candidates, unmatched, wagon } from '../mocks/negotiation';

interface UnmatchedScreenProps {
  onNavigate?: (to: string) => void;
}

/** 04c — 매칭 미성립. 조율 에이전트 발동 지점 */
export function UnmatchedScreen({ onNavigate }: UnmatchedScreenProps) {
  return (
    <AppLayout active="matching">
      <Banner tone="warn">{unmatched.headline}</Banner>

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>배정 대상 공차</CardTitle>
              <span className="rounded-lg bg-[#EAF8F1] px-[11px] py-1.5 text-[13px] font-bold text-[#12A87A]">
                공차 회송 구간
              </span>
            </div>

            <div className="mt-[18px] grid grid-cols-4 gap-4">
              <InfoCell label="구간" value={wagon.route} />
              <InfoCell label="출발 예정" value={wagon.departAt} />
              <InfoCell label="정원" value={wagon.capacityTons} />
              <InfoCell label="최소 적재 기준" value={wagon.minLoadRate} />
            </div>

            <div className="mt-[22px] flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-[#6B7684]">현재 적재율</span>
              <span className="text-[26px] font-extrabold tabular-nums tracking-[-0.03em] text-[#B45309]">
                {unmatched.loadRate}%
              </span>
            </div>
            <span className="mt-2.5 block h-2.5 overflow-hidden rounded-full bg-[#F2F4F6]">
              <span
                className="block h-2.5 rounded-full bg-[#F59E0B]"
                style={{ width: `${unmatched.loadRate}%` }}
              />
            </span>
            <div className="mt-2 flex justify-between text-[13px] text-[#B0B8C1]">
              <span>{unmatched.soloShipper}</span>
              <span>
                최소 기준 {wagon.minLoadRate} · {wagon.minLoadTons}
              </span>
            </div>
          </Card>

          <Card>
            <CardTitle>조율 여지</CardTitle>
            <p className="mt-2 text-[15px] text-[#6B7684]">
              같은 노선에 조건이 어긋난 화주 3곳이 있습니다. 조정 가능한 제약을 찾아 편성을 다시 구성합니다.
            </p>

            <div className="mt-[18px] flex flex-col">
              <div className="grid grid-cols-[150px_90px_1fr_150px] items-center gap-3.5 border-t border-[#F2F4F6] py-3.5 text-[13px] font-bold text-[#B0B8C1]">
                <span>화주</span>
                <span>물량</span>
                <span>어긋난 조건</span>
                <span>조율 여지</span>
              </div>

              {candidates.map((c) => (
                <div
                  key={c.name}
                  className="grid grid-cols-[150px_90px_1fr_150px] items-center gap-3.5 border-t border-[#F2F4F6] py-3.5"
                >
                  <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{c.name}</span>
                  <span className="text-[15px] tabular-nums text-[#4E5968]">{c.tons}</span>
                  <span className="text-[15px] text-[#6B7684]">{c.conflict}</span>
                  <span
                    className={`justify-self-start rounded-lg px-[11px] py-1.5 text-[13px] font-bold ${
                      c.adjustable ? 'bg-[#E8F3FF] text-[#1B64DA]' : 'bg-[#F2F4F6] text-[#6B7684]'
                    }`}
                  >
                    {c.kind}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[20px] bg-white p-6">
            <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#E8F3FF] text-[13px] font-extrabold text-[#1B64DA]">
              AI
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">{agentNote.title}</span>
            <p className="text-[15px] leading-relaxed text-[#6B7684]">{agentNote.body}</p>
            <p className="text-sm leading-relaxed text-[#8B95A1]">{agentNote.caveat}</p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
            <button
              type="button"
              onClick={() => onNavigate?.('/matching/negotiation')}
              className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              조율 에이전트 실행
            </button>
            <button
              type="button"
              className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB]"
            >
              다음 공차 일정 대기
            </button>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
