'use client';

import { useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton } from '../components/AsyncSection';
import { Banner, Card, CardTitle, WagonRouteCard } from '../components/Card';
import { getNegotiationId, getShipment } from '../lib/demo-session';
import { formatCo2, formatKrw, formatNumber, formatPct } from '../lib/format';
import {
  confirmMatching,
  fetchNegotiation,
  type ConcessionOption,
  type Confirmation,
} from '../lib/negotiation';
import { WAGON_TYPE_LABEL } from '../lib/wagons';
import { useAsync } from '../lib/use-async';

/** 화물 여러 건이 화차 1편성으로 모이는 연결선 */
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

interface ConfirmedData {
  confirmation: Confirmation;
  /** 조율에서 제외된 화주 — 왜 이 편성에 없는지 설명하는 자리 */
  excluded: ConcessionOption[];
}

interface ConfirmedScreenProps {
  onNavigate?: (to: string) => void;
}

/**
 * 04e — 편성 확정.
 *
 * 조율 세션이 있으면 **수락된 제안의 화물을 끌어와** 재매칭한 뒤 확정합니다(#19).
 * 어떤 화물을 끌어올지는 화면이 고르는 게 아니라 조율 결과(#25)가 정합니다 —
 * 화면이 임의로 목록을 만들면 서버가 계산한 편성과 어긋납니다.
 */
export function ConfirmedScreen({ onNavigate }: ConfirmedScreenProps) {
  const confirmed = useAsync<ConfirmedData>(
    useCallback(async () => {
      const shipment = getShipment();
      const negotiationId = getNegotiationId();

      const session = negotiationId ? await fetchNegotiation(negotiationId).catch(() => null) : null;
      const accepted = session?.result.proposals.map((p) => p.shipmentId) ?? [];

      const { confirmation } = await confirmMatching(shipment, accepted);
      return { confirmation, excluded: session?.result.rejected ?? [] };
    }, []),
    true, // 확정은 GRP-NNN 을 발급하는 쓰기 호출 — 두 번 부르면 편성이 두 개 생깁니다
  );

  return (
    <AppLayout active="matching">
      <AsyncSection state={confirmed.state} onRetry={confirmed.reload} skeleton={<CardSkeleton height={420} />}>
        {(data) => <ConfirmedBody data={data} onNavigate={onNavigate} />}
      </AsyncSection>
    </AppLayout>
  );
}

function ConfirmedBody({ data, onNavigate }: { data: ConfirmedData; onNavigate?: (to: string) => void }) {
  const { confirmation: c, excluded } = data;
  const calc = c.calc;
  const loadRate = Math.round(c.loadFactor * 100);
  const shares = calc?.shares ?? [];

  return (
    <>
      <Banner tone="info">
        {`편성 확정 · ${c.wagon.label} · 화주 ${c.members.length}곳 · 적재율 ${loadRate}%`}
        {calc ? ` · 합적 단가 ${formatPct(calc.cost.poolingSavingRate)} 인하` : ''}
      </Banner>

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>확정 편성</CardTitle>

            <div className="mt-[18px] grid grid-cols-[1fr_132px_220px] items-center gap-2">
              <div className="flex flex-col gap-2.5">
                {c.members.map((m) => {
                  const share = shares.find((s) => s.shipmentId === m.shipmentId);
                  return (
                    <div
                      key={m.shipmentId}
                      className="rounded-[14px] border border-[#F2F4F6] bg-[#F9FAFB] px-[18px] py-4"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">
                          {m.shipperName}
                        </span>
                        {share && (
                          <span className="text-sm font-bold tabular-nums text-[#12A87A]">
                            {formatPct(share.savingRate)} 절감
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm tabular-nums text-[#8B95A1]">
                        {formatNumber(m.weightTon, 1)}t · {m.category}
                        {m.requiresNegotiation ? ` · ${m.requiresNegotiation}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              <MergeLines />

              <div className="rounded-2xl bg-[#0B1220] p-[22px]">
                <div className="text-sm font-semibold text-[#8B95A1]">
                  {WAGON_TYPE_LABEL[c.wagon.wagonType]} 1편성
                </div>
                <div className="mt-1.5 text-xl font-extrabold tabular-nums tracking-[-0.03em] text-white">
                  {c.groupId}
                </div>

                <div className="mt-[18px] flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-[#8B95A1]">적재율</span>
                  <span className="text-[26px] font-extrabold tabular-nums tracking-[-0.03em] text-white">
                    {loadRate}%
                  </span>
                </div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/[0.14]">
                  <span
                    className="block h-1.5 rounded-full bg-[#15C47E]"
                    style={{ width: `${Math.min(loadRate, 100)}%` }}
                  />
                </span>
              </div>
            </div>

            {/* 화차 배정 승인(#43)은 미구현이라, 지금 확실한 것(확정 시각·편성 번호)만 적습니다 */}
            <div className="mt-[18px] flex items-center gap-2 border-t border-[#F2F4F6] pt-[14px] text-sm text-[#8B95A1]">
              <span className="text-[13px] font-extrabold text-[#12A87A]">✓</span>
              <span>
                편성 확정 · <b className="font-bold text-[#4E5968]">{c.groupId}</b> ·{' '}
                <span className="tabular-nums">{new Date(c.confirmedAt).toLocaleString('ko-KR')}</span>
              </span>
            </div>
          </Card>

          <WagonRouteCard
            route={c.wagon.label}
            departLabel="출발"
            departAt={`${c.wagon.departure.date} ${c.wagon.departure.time}`}
            third={{ label: '화차 종류', value: WAGON_TYPE_LABEL[c.wagon.wagonType] }}
            fourth={{
              label: '총 물량 · 정원',
              value: `${formatNumber(c.totalTon, 1)}t / ${formatNumber(c.capacityTon, 1)}t`,
            }}
          />

          {excluded.map((e) => (
            <div
              key={e.shipmentId}
              className="flex items-center gap-3.5 rounded-[20px] bg-white px-[26px] py-[22px]"
            >
              <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F2F4F6] text-xs font-extrabold text-[#8B95A1]">
                ✕
              </span>
              <span className="text-[15px] text-[#6B7684]">
                <b className="text-[#4E5968]">
                  {e.shipperName} {formatNumber(e.weightTon, 1)}t 제외
                </b>{' '}
                · {e.rejectReason ?? e.conflict}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">
              도로 단독 vs 철도 합적
            </span>

            {calc ? (
              <>
                <div className="mt-[18px] grid grid-cols-2 gap-2.5">
                  <div className="rounded-[14px] bg-[#F9FAFB] p-4">
                    <div className="text-[13px] font-bold text-[#8B95A1]">도로 단독</div>
                    <div className="mt-3 text-xs text-[#B0B8C1]">운송비</div>
                    <div className="text-lg font-extrabold tracking-[-0.03em] text-[#8B95A1]">
                      {formatKrw(calc.cost.roadOnlyKrw)}
                    </div>
                    <div className="mt-2.5 text-xs text-[#B0B8C1]">탄소 배출</div>
                    <div className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#8B95A1]">
                      {formatCo2(calc.benefit.roadCo2Ton)}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-[#3182F6] bg-[#F5F9FF] p-4">
                    <div className="text-[13px] font-bold text-[#1B64DA]">철도 합적</div>
                    <div className="mt-3 text-xs text-[#8B95A1]">운송비</div>
                    <div className="text-lg font-extrabold tracking-[-0.03em] text-[#191F28]">
                      {formatKrw(calc.cost.railPooledKrw)}
                    </div>
                    <div className="mt-2.5 text-xs text-[#8B95A1]">탄소 배출</div>
                    <div className="text-lg font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
                      {formatCo2(calc.benefit.railCo2Ton)}
                    </div>
                  </div>
                </div>

                {/*
                  합적 효과 = 각자 화차를 잡았을 때 대비 인하분입니다. 도로 대비 비교와
                  섞으면 안 됩니다 — 소량 화물은 도로 운임 자체가 톤당 훨씬 비쌉니다.
                */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[#EAF8F1] px-4 py-3.5">
                  <span className="text-[15px] font-bold text-[#12A87A]">합적 단가 인하</span>
                  <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[#0F7A5A]">
                    {formatPct(calc.cost.poolingSavingRate)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3">
                  <span className="text-[13px] font-semibold text-[#6B7684]">탄소 감축</span>
                  <span className="text-[15px] font-bold tabular-nums text-[#191F28]">
                    {formatCo2(calc.benefit.co2ReducedTon)} ({formatPct(calc.benefit.co2ReducedRate)})
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-4 text-[15px] text-[#8B95A1]">
                편성이 성립해야 편익이 계산됩니다.
              </p>
            )}
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
    </>
  );
}
