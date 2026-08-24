'use client';

import { useCallback, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton } from '../components/AsyncSection';
import { Banner, Card, CardTitle, InfoCell } from '../components/Card';
import { getNegotiationId, getRegisteredId, getShipment } from '../lib/demo-session';
import { formatNumber, formatPct } from '../lib/format';
import { requestMatching, type MatchResult } from '../lib/freight';
import { cancelNegotiation } from '../lib/negotiation';
import { useAsync } from '../lib/use-async';
import { agentNote } from '../mocks/negotiation';

interface UnmatchedScreenProps {
  onNavigate?: (to: string) => void;
}

/**
 * 04c — 매칭 미성립. 조율 에이전트 발동 지점.
 *
 * #16 을 다시 부릅니다 — 04a 에서 넘어온 화물(세션)로 같은 편성을 재현합니다.
 * LLM 을 타지 않는 계산이라 재호출이 쌉니다. 여기서 조율(#22)을 미리 돌리지
 * **않습니다**: 그건 "조율 에이전트 실행" 버튼이 하는 일이고, 미리 돌리면
 * 화면을 열어만 봐도 LLM 값을 지불하게 됩니다.
 */
export function UnmatchedScreen({ onNavigate }: UnmatchedScreenProps) {
  const match = useAsync<MatchResult>(
    useCallback(() => requestMatching(getShipment(), getRegisteredId()), []),
  );

  return (
    <AppLayout active="matching">
      <AsyncSection state={match.state} onRetry={match.reload} skeleton={<CardSkeleton height={420} />}>
        {(m) => <UnmatchedBody match={m} onNavigate={onNavigate} />}
      </AsyncSection>
    </AppLayout>
  );
}

/**
 * "다음 공차 일정 대기" — 예전에는 그냥 /home 으로 보냈습니다.
 * 사용자가 기대하는 건 **다음 공차가 언제인지**이므로, 조율 세션이 있으면 #26 으로
 * 안내를 받고(대기 전환), 없으면 이 편성의 화차 시각표를 그대로 보여줍니다.
 */
function NextWagonAction({
  match: m,
  onNavigate,
}: {
  match: MatchResult;
  onNavigate?: (to: string) => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = () =>
    m.wagon
      ? `${m.wagon.label} · ${m.wagon.departure.date} ${m.wagon.departure.time} 출발 (마감 ${m.wagon.cutoffAt.slice(0, 10)})`
      : '지금 이 노선에 배정 가능한 공차가 없습니다.';

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const id = getNegotiationId();
            if (id) {
              const res = await cancelNegotiation(id);
              setNotice(
                res.nextWagon
                  ? `다음 공차 ${res.nextWagon.label} · ${res.nextWagon.departAt.slice(0, 10)} 출발`
                  : res.message,
              );
            } else {
              setNotice(describe());
            }
          } catch {
            setNotice(describe());
          } finally {
            setBusy(false);
          }
        }}
        className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB] disabled:opacity-60"
      >
        {busy ? '확인 중…' : '다음 공차 일정 대기'}
      </button>
      {notice && (
        <div className="rounded-xl bg-[#E8F3FF] px-4 py-3 text-[13px] leading-relaxed font-semibold text-[#1B64DA]">
          {notice}
          <button
            type="button"
            onClick={() => onNavigate?.('/home')}
            className="ml-2 underline underline-offset-2"
          >
            홈으로
          </button>
        </div>
      )}
    </>
  );
}

function UnmatchedBody({ match: m, onNavigate }: { match: MatchResult; onNavigate?: (to: string) => void }) {
  const loadRate = Math.round(m.loadFactor * 100);
  const minRate = m.wagon ? Math.round(m.wagon.minLoadRate * 100) : 60;
  const minTon = m.wagon ? m.wagon.capacityTon * m.wagon.minLoadRate : 0;
  const solo = m.members.map((x) => `${x.shipperName} ${formatNumber(x.weightTon, 1)}t`).join(' · ');

  return (
    <>
      {/* 배너 문구는 서버 판정 그대로. 화면이 다시 쓰면 판정과 어긋납니다 */}
      <Banner tone="warn">{m.message}</Banner>

      <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>배정 대상 공차</CardTitle>
              <span className="rounded-lg bg-[#EAF8F1] px-[11px] py-1.5 text-[13px] font-bold text-[#12A87A]">
                공차 회송 구간
              </span>
            </div>

            <div className="mt-[18px] grid grid-cols-2 gap-4 lg:grid-cols-4">
              <InfoCell label="구간" value={m.wagon ? m.wagon.label : '배정 가능한 공차 없음'} />
              <InfoCell
                label="출발 예정"
                value={m.wagon ? `${m.wagon.departure.date} ${m.wagon.departure.time}` : '—'}
              />
              <InfoCell label="정원" value={`${formatNumber(m.capacityTon, 1)}t`} />
              <InfoCell label="최소 적재 기준" value={`${minRate}%`} />
            </div>

            <div className="mt-[22px] flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-[#6B7684]">현재 적재율</span>
              <span className="text-[26px] font-extrabold tabular-nums tracking-[-0.03em] text-[#B45309]">
                {loadRate}%
              </span>
            </div>
            <span className="mt-2.5 block h-2.5 overflow-hidden rounded-full bg-[#F2F4F6]">
              <span
                className="block h-2.5 rounded-full bg-[#F59E0B] transition-[width] duration-500"
                style={{ width: `${Math.min(loadRate, 100)}%` }}
              />
            </span>
            <div className="mt-2 flex flex-col gap-1 text-[13px] text-[#B0B8C1] sm:flex-row sm:justify-between">
              <span>{solo || '등록된 화물 없음'}</span>
              <span>
                최소 기준 {minRate}% · {formatNumber(minTon, 1)}t · 부족 {formatNumber(m.shortfallTon, 1)}t
              </span>
            </div>
          </Card>

          <Card>
            <CardTitle>조율 여지</CardTitle>
            <p className="mt-2 text-[15px] text-[#6B7684]">
              {m.negotiationCandidates.length
                ? `같은 노선에 조건이 어긋난 화주 ${m.negotiationCandidates.length}곳이 있습니다. 조정 가능한 제약을 찾아 편성을 다시 구성합니다.`
                : '지금 이 노선에는 조율로 끌어올 수 있는 화물이 없습니다. 다음 공차 일정을 기다립니다.'}
            </p>

            {m.negotiationCandidates.length > 0 && (
              <div className="mt-[18px] flex flex-col">
                <div className="hidden grid-cols-[150px_90px_1fr_120px] items-center gap-3.5 border-t border-[#F2F4F6] py-3.5 text-[13px] font-bold text-[#B0B8C1] md:grid">
                  <span>화주</span>
                  <span>물량</span>
                  <span>어긋난 조건</span>
                  <span>품목</span>
                </div>

                {m.negotiationCandidates.map((c) => (
                  <div
                    key={c.shipmentId}
                    className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-[#F2F4F6] py-3.5 md:grid md:grid-cols-[150px_90px_1fr_120px]"
                  >
                    <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{c.shipperName}</span>
                    <span className="text-[15px] tabular-nums text-[#4E5968]">
                      {formatNumber(c.weightTon, 1)}t
                    </span>
                    {/* 왜 지금은 못 타는지 — 서버가 판정해 문장으로 담아 보냅니다 */}
                    <span className="text-[15px] text-[#6B7684]">{c.requiresNegotiation ?? c.description}</span>
                    <span className="justify-self-start rounded-lg bg-[#F2F4F6] px-[11px] py-1.5 text-[13px] font-bold text-[#6B7684]">
                      {c.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
              disabled={!m.negotiationCandidates.length}
              onClick={() => onNavigate?.('/matching/negotiation')}
              className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] disabled:bg-[#B0B8C1]"
            >
              조율 에이전트 실행
            </button>
            <NextWagonAction match={m} onNavigate={onNavigate} />
            <span className="text-[13px] leading-relaxed text-[#8B95A1]">
              적재율 {formatPct(m.loadFactor)} · 마감까지 {Math.max(0, Math.round(m.hoursToCutoff))}시간
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
