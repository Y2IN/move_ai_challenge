'use client';

import { useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton } from '../components/AsyncSection';
import { Banner, Card, CardTitle, WagonRouteCard } from '../components/Card';
import { getConfirmationId, getNegotiationId, setConfirmationId } from '../lib/demo-session';
import { formatCo2, formatKrw, formatNumber, formatPct } from '../lib/format';
import {
  fetchConfirmation,
  fetchLatestConfirmation,
  fetchNegotiation,
  type ConcessionOption,
  type Confirmation,
} from '../lib/negotiation';
import { WAGON_TYPE_LABEL } from '../lib/wagons';
import { useAsync } from '../lib/use-async';

/** 화물 여러 건이 화차 1편성으로 모이는 연결선 */
function MergeLines() {
  return (
    <svg viewBox="0 0 132 220" className="hidden h-[220px] w-[132px] lg:block" aria-hidden="true">
      <path d="M0 36 C 66 36, 66 110, 132 110" fill="none" stroke="#B0B8C1" strokeWidth="2" />
      <path d="M0 110 L 132 110" fill="none" stroke="#B0B8C1" strokeWidth="2" />
      <path d="M0 184 C 66 184, 66 110, 132 110" fill="none" stroke="#B0B8C1" strokeWidth="2" />
      <circle cx="132" cy="110" r="4" fill="#3182F6" />
    </svg>
  );
}

interface ConfirmedData {
  /** 아직 확정한 편성이 없으면 null — 빈 상태 안내를 그린다 */
  confirmation: Confirmation | null;
  /** 조율에서 제외된 화주 — 왜 이 편성에 없는지 설명하는 자리 */
  excluded: ConcessionOption[];
}

interface ConfirmedScreenProps {
  onNavigate?: (to: string) => void;
}

/**
 * 04e — 편성 확정.
 *
 * **이 화면은 조회 전용입니다.** 확정(GRP-NNN 발급)은 조율 화면(04d)의
 * "편성 확정하기" 버튼이 합니다. 예전에는 이 화면이 마운트될 때마다 확정 API 를
 * 불러서, 새로고침·뒤로가기·재시도마다 편성이 하나씩 더 생겼습니다.
 *
 * 세션에 편성 번호가 있으면 그걸로 조회하고, 없으면 마지막 확정을 보여줍니다.
 * 둘 다 없으면 "확정된 편성이 없습니다" 안내와 함께 조율 화면으로 돌려보냅니다.
 */
export function ConfirmedScreen({ onNavigate }: ConfirmedScreenProps) {
  const confirmed = useAsync<ConfirmedData>(
    useCallback(async () => {
      const negotiationId = getNegotiationId();
      const groupId = getConfirmationId();

      // 조율 세션 조회 실패를 조용히 삼키지 않습니다. 예전에는 catch 로 뭉개서
      // 제외 화주 목록이 빈 채로 그려졌고, 왜 비었는지 알 방법이 없었습니다.
      const session = negotiationId ? await fetchNegotiation(negotiationId) : null;

      if (groupId) {
        const { confirmation } = await fetchConfirmation(groupId);
        return { confirmation, excluded: session?.result.rejected ?? [] };
      }

      const latest = await fetchLatestConfirmation();
      if (latest.confirmation) {
        setConfirmationId(latest.confirmation.groupId);
        return { confirmation: latest.confirmation, excluded: session?.result.rejected ?? [] };
      }
      return { confirmation: null, excluded: session?.result.rejected ?? [] };
    }, []),
    true,
  );

  return (
    <AppLayout active="matching">
      <AsyncSection state={confirmed.state} onRetry={confirmed.reload} skeleton={<CardSkeleton height={420} />}>
        {(data) =>
          data.confirmation ? (
            <ConfirmedBody
              data={{ confirmation: data.confirmation, excluded: data.excluded }}
              onNavigate={onNavigate}
            />
          ) : (
            <EmptyConfirmation onNavigate={onNavigate} />
          )
        }
      </AsyncSection>
    </AppLayout>
  );
}

/** 확정된 편성이 아직 없을 때 — 막다른 길을 만들지 않고 조율 화면으로 돌려보냅니다. */
function EmptyConfirmation({ onNavigate }: { onNavigate?: (to: string) => void }) {
  return (
    <Card>
      <CardTitle>확정된 편성이 없습니다</CardTitle>
      <p className="mt-3 text-[15px] leading-relaxed text-[#4E5968]">
        편성은 조율 화면에서 <b>편성 확정하기</b>를 눌러야 발급됩니다. 아직 확정한 편성이 없거나,
        브라우저 세션이 초기화된 상태입니다.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNavigate?.('/matching/negotiation')}
          className="rounded-xl bg-[#3182F6] px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
        >
          조율 화면으로
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('/freight/new')}
          className="rounded-xl border border-[#E5E8EB] px-5 py-3 text-[15px] font-bold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
        >
          화물 등록하기
        </button>
      </div>
    </Card>
  );
}

function ConfirmedBody({
  data,
  onNavigate,
}: {
  data: ConfirmedData & { confirmation: Confirmation };
  onNavigate?: (to: string) => void;
}) {
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

      <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>확정 편성</CardTitle>

            <div className="mt-[18px] grid grid-cols-1 items-center gap-2 lg:grid-cols-[1fr_132px_220px]">
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

            {/* 확정(화주)과 배차 승인(코레일 #43)은 다른 사건이라 둘 다 보여줍니다 */}
            <div className="mt-[18px] flex flex-col gap-1.5 border-t border-[#F2F4F6] pt-[14px] text-sm text-[#8B95A1]">
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold text-[#12A87A]">✓</span>
                <span>
                  편성 확정 · <b className="font-bold text-[#4E5968]">{c.groupId}</b> ·{' '}
                  <span className="tabular-nums">{new Date(c.confirmedAt).toLocaleString('ko-KR')}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                {c.status === 'approved' ? (
                  <>
                    <span className="text-[13px] font-extrabold text-[#12A87A]">✓</span>
                    <span>
                      코레일 배차 승인
                      {c.approvedAt ? (
                        <>
                          {' · '}
                          <span className="tabular-nums">
                            {new Date(c.approvedAt).toLocaleString('ko-KR')}
                          </span>
                        </>
                      ) : null}
                      {c.approvedBy ? ` · ${c.approvedBy}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-extrabold text-[#C77700]">…</span>
                    <span>코레일 배차 승인 대기 중</span>
                  </>
                )}
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
                <div className="mt-[18px] grid grid-cols-1 gap-2.5 md:grid-cols-2">
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
