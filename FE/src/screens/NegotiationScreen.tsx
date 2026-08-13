'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { AsyncSection, CardSkeleton } from '../components/AsyncSection';
import { getShipment, setNegotiationId } from '../lib/demo-session';
import { formatKrw, formatNumber } from '../lib/format';
import { requestMatching, type MatchResult } from '../lib/freight';
import {
  openNegotiationStream,
  runNegotiation,
  type ConcessionOption,
  type NegotiationRun,
  type Proposal,
} from '../lib/negotiation';
import { useAsync } from '../lib/use-async';

interface NegotiationScreenProps {
  onNavigate?: (to: string) => void;
}

interface RunData {
  negotiation: NegotiationRun;
  match: MatchResult;
}

/** 스트림(#23)이 재생하는 진행 상태. 서버가 보낸 것만 담습니다. */
interface StreamState {
  loadRate: number | null;
  /** 제안이 제시된 단계 번호 */
  revealed: number[];
  /** 수락으로 반영된 단계 번호 */
  accepted: number[];
  done: boolean;
  error: string | null;
}

const EMPTY_STREAM: StreamState = { loadRate: null, revealed: [], accepted: [], done: false, error: null };

/**
 * 04d — 조율 진행.
 *
 * #22 로 조율을 **한 번** 실행하고(LLM), 그 세션을 #23 SSE 로 재생해 적재율
 * 게이지와 타임라인을 채웁니다. 재생은 저장된 결과를 읽는 것이라 LLM 을 다시
 * 타지 않으므로, 새로고침해도 값이 바뀌지 않습니다.
 */
export function NegotiationScreen({ onNavigate }: NegotiationScreenProps) {
  const run = useAsync<RunData>(
    useCallback(() => {
      const shipment = getShipment();
      // 편성 정보(노선·최소 적재 기준)는 계산 API 에서, 제안은 조율 API 에서 옵니다.
      return Promise.all([runNegotiation(shipment), requestMatching(shipment)]).then(
        ([negotiation, match]) => {
          setNegotiationId(negotiation.id);
          return { negotiation, match };
        },
      );
    }, []),
    true, // LLM 호출 — dev StrictMode 의 2회 실행을 막습니다
  );

  const [stream, setStream] = useState<StreamState>(EMPTY_STREAM);
  const negotiationId = run.state.status === 'ready' ? run.state.data.negotiation.id : null;
  const before = run.state.status === 'ready' ? run.state.data.negotiation.before : null;

  useEffect(() => {
    if (!negotiationId || !before) return;
    setStream({ ...EMPTY_STREAM, loadRate: before.loadRate });

    return openNegotiationStream(negotiationId, {
      onStart: (e) => setStream((s) => ({ ...s, loadRate: e.loadRate })),
      onLoadRate: (e) => setStream((s) => ({ ...s, loadRate: e.to })),
      onProposal: (e) =>
        setStream((s) =>
          e.status === 'ACCEPTED'
            ? { ...s, accepted: [...s.accepted, e.step] }
            : { ...s, revealed: [...s.revealed, e.step] },
        ),
      onDone: (e) => setStream((s) => ({ ...s, loadRate: e.finalLoadRate, done: true })),
      onError: (message) => setStream((s) => ({ ...s, error: message, done: true })),
    });
  }, [negotiationId, before]);

  return (
    <AppLayout active="matching">
      <AsyncSection state={run.state} onRetry={run.reload} skeleton={<CardSkeleton height={140} />}>
        {(data) => <NegotiationBody data={data} stream={stream} onNavigate={onNavigate} />}
      </AsyncSection>
    </AppLayout>
  );
}

function NegotiationBody({
  data,
  stream,
  onNavigate,
}: {
  data: RunData;
  stream: StreamState;
  onNavigate?: (to: string) => void;
}) {
  const { negotiation: n, match: m } = data;
  const pct = (rate: number) => Math.round(rate * 100);

  const startPct = pct(n.before.loadRate);
  const currentPct = pct(stream.loadRate ?? n.before.loadRate);
  const targetPct = n.after ? pct(n.after.loadRate) : startPct;
  const minPct = m.wagon ? pct(m.wagon.minLoadRate) : null;

  const route = m.wagon?.label ?? '배정 대상 공차';

  return (
    <>
      <section className="rounded-[20px] bg-white px-[26px] py-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">
            {stream.done ? '조율 완료' : '조율 진행 중'} · {route}
          </span>
          <span className="flex items-baseline gap-2.5">
            <span className="text-sm text-[#8B95A1]">적재율</span>
            <span className="text-[15px] tabular-nums text-[#B0B8C1] line-through">{startPct}%</span>
            <span className="text-3xl font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {currentPct}%
            </span>
          </span>
        </div>

        {/* 진행 중에는 현재값이 자라고, done 이후에는 최종값에서 멈춥니다 */}
        <span className="relative mt-3 block h-3 overflow-hidden rounded-full bg-[#F2F4F6]">
          <span
            className="absolute left-0 top-0 h-3 rounded-full bg-[#15C47E] transition-[width] duration-700"
            style={{ width: `${Math.min(currentPct, 100)}%` }}
          />
          <span
            className="absolute left-0 top-0 h-3 rounded-full bg-[#191F28]"
            style={{ width: `${Math.min(startPct, 100)}%` }}
          />
          {minPct != null && (
            <span className="absolute top-0 h-3 w-0.5 bg-white" style={{ left: `${minPct}%` }} />
          )}
        </span>

        <div className="mt-2 flex gap-5 text-[13px] text-[#8B95A1]">
          <span>
            <b className="text-[#191F28]">{startPct}%</b> 조율 전
          </span>
          <span>
            <b className="text-[#12A87A]">{targetPct}%</b> 전원 수락 시
          </span>
          <span>부족 {formatNumber(n.before.shortfallTon, 1)}t</span>
          {minPct != null && <span className="ml-auto text-[#B0B8C1]">최소 기준 {minPct}%</span>}
        </div>

        {stream.error && <p className="mt-2 text-[13px] font-semibold text-[#C77700]">{stream.error}</p>}
      </section>

      {/* items-start 없이 stretch — 두 패널이 내용 많은 쪽 높이에 맞춰 함께 늘어난다 */}
      <section className="grid grid-cols-[480px_1fr] gap-4">
        <div className="flex flex-col gap-3 rounded-[20px] bg-white px-6 py-[22px]">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">화주 제약 분류</span>
          <p className="text-[13px] leading-relaxed text-[#8B95A1]">
            조정 가능한 조건은 제안 대상이 되고, 절대 조건이거나 양보 대가가 절감액보다 크면 제외됩니다.
          </p>
          <div className="flex flex-col gap-2.5">
            {n.proposals.map((p) => (
              <ShipperCard key={p.shipmentId} option={p} />
            ))}
            {n.rejected.map((r) => (
              <ShipperCard key={r.shipmentId} option={r} excluded />
            ))}
            {!n.proposals.length && !n.rejected.length && (
              <p className="text-[15px] text-[#8B95A1]">조율 대상 화주가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-white px-6 py-[22px]">
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">협상 타임라인</span>
            <span className="text-sm text-[#8B95A1]">
              제안 {n.proposals.length}건 · 제외 {n.rejected.length}건
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-2.5">
            {n.proposals.map((p, i) => {
              const step = i + 1;
              if (!stream.revealed.includes(step)) return null;
              return <ProposalStep key={p.shipmentId} proposal={p} accepted={stream.accepted.includes(step)} />;
            })}

            {!stream.done && (
              <span className="text-[13px] font-semibold text-[#3182F6]">
                화주 응답을 기다리는 중<span className="dot-wave">···</span>
              </span>
            )}

            {stream.done &&
              n.rejected.map((r) => (
                <RejectedStep key={r.shipmentId} option={r} />
              ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#F2F4F6] pt-3">
            <span className="text-sm text-[#8B95A1]">{n.message}</span>
            <button
              type="button"
              disabled={!stream.done || !n.feasible}
              title={n.feasible ? undefined : '조율로도 정원을 채우지 못했습니다'}
              onClick={() => onNavigate?.('/matching/confirmed')}
              className="h-12 rounded-xl bg-[#3182F6] px-[22px] text-base font-bold text-white transition-colors hover:bg-[#1B64DA] disabled:bg-[#B0B8C1]"
            >
              편성 확정하기
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/** 화주 한 곳의 제약. 제외된 화주는 사유를 함께 보여줍니다. */
function ShipperCard({ option, excluded }: { option: ConcessionOption; excluded?: boolean }) {
  return (
    <div
      className={[
        'rounded-[14px] border px-4 py-3.5',
        excluded ? 'border-[#E5E8EB] bg-white opacity-[0.72]' : 'border-[#F2F4F6] bg-[#F9FAFB]',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">
          {option.shipperName}{' '}
          <span className="text-sm font-semibold tabular-nums text-[#8B95A1]">
            {formatNumber(option.weightTon, 1)}t
          </span>
        </span>
        <span
          className={`whitespace-nowrap rounded-md px-[9px] py-1 text-xs font-bold ${
            excluded ? 'bg-[#F2F4F6] text-[#6B7684]' : 'bg-[#E8F3FF] text-[#1B64DA]'
          }`}
        >
          {excluded ? '제외' : '조정 가능'}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[#6B7684]">{option.conflict}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-[#E8F3FF] px-[9px] py-1 text-xs font-semibold text-[#1B64DA]">
          {option.ask}
        </span>
        {excluded && option.rejectReason && (
          <span className="rounded-md bg-[#F2F4F6] px-[9px] py-1 text-xs font-semibold text-[#4E5968]">
            {option.rejectReason}
          </span>
        )}
      </div>
    </div>
  );
}

function ProposalStep({ proposal, accepted }: { proposal: Proposal; accepted: boolean }) {
  return (
    <div className="grid grid-cols-[22px_1fr] gap-3">
      <span
        className={`mt-0.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-extrabold ${
          accepted ? 'bg-[#15C47E] text-white' : 'bg-[#FFF4E0] text-[#C77700]'
        }`}
      >
        {accepted ? '✓' : '~'}
      </span>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[#191F28]">
            {proposal.shipperName} · {proposal.ask}
          </span>
          <span
            className={`whitespace-nowrap rounded-md px-2 py-[3px] text-xs font-bold ${
              accepted ? 'bg-[#EAF8F1] text-[#12A87A]' : 'bg-[#FFF4E0] text-[#C77700]'
            }`}
          >
            {accepted ? '수락' : '제안 발송'}
          </span>
          <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-[#B0B8C1]">
            절감 {formatKrw(proposal.savingKrw)}
          </span>
        </div>

        <div className="relative mt-1.5 rounded-[10px] border border-[#D6E7FF] bg-[#F5F9FF] px-3.5 py-3">
          <p className="text-[13px] leading-[1.7] text-[#333D4B]">{proposal.message}</p>
          <span className="absolute -bottom-2 left-3.5 rounded-md bg-[#D6E7FF] px-2 py-0.5 text-[11px] font-bold text-[#1B64DA]">
            {proposal.source === 'ai' ? 'AI 서술 · 화주 발송용' : '사전 작성 초안 · 화주 발송용'}
          </span>
        </div>

        {/* 양보 대가와 순이득 — 이 비교가 제안 여부를 가른 근거입니다 */}
        <div className="mt-3 text-[13px] text-[#8B95A1]">
          양보 대가 {formatKrw(proposal.concessionCostKrw)} 대비 순이득 {formatKrw(proposal.netGainKrw)}
        </div>
      </div>
    </div>
  );
}

function RejectedStep({ option }: { option: ConcessionOption }) {
  return (
    <div className="grid grid-cols-[22px_1fr] gap-3">
      <span className="mt-0.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#F2F4F6] text-xs font-extrabold text-[#8B95A1]">
        ✕
      </span>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[#6B7684]">
            {option.shipperName} · {option.ask}
          </span>
          <span className="whitespace-nowrap rounded-md bg-[#F2F4F6] px-2 py-[3px] text-xs font-bold text-[#6B7684]">
            제안 안 함
          </span>
        </div>
        <div className="mt-1 text-[13px] text-[#8B95A1]">{option.rejectReason ?? option.conflict}</div>
      </div>
    </div>
  );
}
