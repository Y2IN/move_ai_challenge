'use client';

import { useCallback, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useAccount } from '../lib/account';
import { fetchEsgIndicators, type EsgIndicatorsResponse } from '../lib/esg';
import { formatDocDate, formatTon, formatTrips } from '../lib/format';
import { ApplyDocument } from '../components/ApplyDocument';
import { fetchApplication } from '../lib/subsidy';
import { toApplyDocView, type ApplyDocView } from '../lib/subsidy-view';
import { useAsync } from '../lib/use-async';
import { fetchPreflight, type PreflightItem, type PreflightResponse } from '../lib/subsidy';
import { applyMeta, breadcrumb, checklist, type ChecklistItem } from '../mocks/apply';

/** 판정 상태별 배지 색. blocked 는 "이대로 만들면 서식이 빈다"는 뜻이라 눈에 띄어야 합니다. */
const STATE_STYLE: Record<'ready' | 'pending' | 'blocked' | 'ai', string> = {
  ready: 'bg-[#EAF8F1] text-[#12A87A]',
  pending: 'bg-[#F2F4F6] text-[#8B95A1]',
  blocked: 'bg-[#FFF0F0] text-[#E03131]',
  ai: 'bg-[#E8F3FF] text-[#3182F6]',
};

const STATUS_COLOR: Record<'ready' | 'pending' | 'blocked', string> = {
  ready: 'text-[#4E5968]',
  pending: 'text-[#8B95A1]',
  blocked: 'text-[#E03131]',
};

/**
 * 서버 점검(#30)을 못 받았을 때만 쓰는 목록.
 *
 * 판정을 화면에서 다시 하지 않습니다 — 서버가 못 오면 "확인 중"으로 두고,
 * 준비됐다고 단정하지 않는 게 맞습니다 (예전 고정 문구가 그렇게 단정했습니다).
 */
function toFallbackItem(c: ChecklistItem): PreflightItem {
  return {
    key: c.title,
    title: c.title,
    desc: c.desc,
    state: 'pending',
    status: '점검 결과를 불러오는 중…',
    ai: c.ai,
  };
}

interface ApplyIntroScreenProps {
  /** 초안 발급 중. 연타로 초안이 여러 개 생기는 걸 막는다 */
  busy?: boolean;
  error?: string | null;
  /** "보고서 초안 생성" — 컨테이너가 빈 서식을 발급하고 06b 로 보낸다 */
  onStart?: () => void;
  onNavigate?: (to: string) => void;
  onBack?: () => void;
}

/** 06a — 보조금 신청서 생성 전 */
export function ApplyIntroScreen({
  busy = false,
  error = null,
  onStart,
  onNavigate,
  onBack,
}: ApplyIntroScreenProps) {
  /** 이 화면의 수치는 전부 #40 집계입니다. LLM 을 타지 않아 재진입이 쌉니다. */
  const indicators = useAsync<EsgIndicatorsResponse>(useCallback(() => fetchEsgIndicators(), []));
  /** #30 — 체크리스트는 서버 판정입니다. 화면 상수(고정 문구)를 쓰지 않습니다. */
  const preflight = useAsync<PreflightResponse>(useCallback(() => fetchPreflight(), []));
  const pre = preflight.state.status === 'ready' ? preflight.state.data : null;
  const account = useAccount('corp');

  // 빈 서식 미리보기 — 저장되지 않는 초안(stage: "draft")을 그대로 렌더합니다.
  // 별도 라우트가 필요 없습니다: 없는 id 로 조회하면 서버가 빈 서식을 돌려줍니다.
  const [preview, setPreview] = useState<ApplyDocView | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const openPreview = useCallback(async () => {
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      const res = await fetchApplication('preview');
      setPreview(toApplyDocView(res.document));
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : '빈 서식을 불러오지 못했습니다.');
    } finally {
      setPreviewBusy(false);
    }
  }, []);
  const res = indicators.state.status === 'ready' ? indicators.state.data : null;
  /** 로딩과 실패는 다른 상태입니다. 실패를 "집계 중…" 으로 두면 영원히 기다리게 됩니다. */
  const pending = indicators.state.status === 'error' ? '집계에 실패했습니다' : '집계 중…';

  const criteria = [
    {
      label: '대상 기간',
      value: res ? `${formatDocDate(res.period.from)} ~ ${formatDocDate(res.period.to)}` : pending,
    },
    {
      label: '전환 운송 실적',
      value: res ? `${formatTrips(res.summary.tripCount)} · ${formatTon(res.summary.totalTon)}` : pending,
    },
    // 인증(#1~#5)이 MVP 범위 밖이라 `/api/me` 가 없습니다. 신청 주체는 계정 표시값입니다.
    { label: '신청 주체', value: res?.shipperName ?? account?.org ?? '확인 중…' },
    { label: '예상 소요', value: '약 10초' },
  ];

  return (
    <AppLayout active="subsidy">
      {preview && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-8"
          onClick={() => setPreview(null)}
        >
          <div
            className="mx-auto flex w-[880px] max-w-full flex-col gap-4 rounded-2xl bg-white p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-extrabold tracking-[-0.03em] text-[#191F28]">
                  빈 서식 미리보기
                </h2>
                <p className="text-[13px] text-[#8B95A1]">
                  실제 생성 전 서식 구조만 보여줍니다. 이 문서는 저장되지 않습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-10 rounded-xl border border-[#E5E8EB] px-4 text-sm font-bold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
              >
                닫기
              </button>
            </div>
            {/* 재생성 핸들러를 주지 않아 읽기 전용으로 렌더됩니다 */}
            <ApplyDocument doc={preview} />
          </div>
        </div>
      )}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-[#8B95A1]">
          <button type="button" onClick={onBack} className="font-bold text-[#4E5968]">
            ← 뒤로
          </button>
          {breadcrumb.map((b, i) => (
            <span key={b} className={i === breadcrumb.length - 1 ? 'font-bold text-[#4E5968]' : ''}>
              {i > 0 && <span className="mr-2 text-[#B0B8C1]">›</span>}
              {b}
            </span>
          ))}
        </div>

        <span className="text-sm font-bold text-[#3182F6]">
          {res
            ? `${res.period.label} 실적 기준`
            : indicators.state.status === 'error'
              ? '실적을 집계하지 못했습니다'
              : '실적을 집계하는 중…'}
        </span>
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">{applyMeta.title}</h1>
        <p className="text-base text-[#6B7684]">{applyMeta.legalBasis}</p>
      </header>

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-7 pb-6 pt-7">
          <div className="flex items-center justify-between">
            <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">무엇이 만들어지나요</span>
            <span className="rounded-lg bg-[#F2F4F6] px-[11px] py-1.5 text-[13px] font-bold text-[#6B7684]">
              {(pre?.items ?? checklist).length}개 항목
            </span>
          </div>

          <div className="mt-[18px] flex flex-col">
            {(pre?.items ?? checklist.map(toFallbackItem)).map((c) => (
              <div key={c.key} className="flex items-center gap-3.5 border-t border-[#F2F4F6] py-4">
                <span
                  className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${
                    STATE_STYLE[c.ai ? 'ai' : c.state]
                  }`}
                >
                  {c.ai ? 'AI' : c.state === 'blocked' ? '!' : c.state === 'pending' ? '…' : '✓'}
                </span>

                <div className="flex-1">
                  <div className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{c.title}</div>
                  <div className="mt-[3px] text-sm text-[#8B95A1]">{c.desc}</div>
                </div>

                <span
                  className={`text-sm font-semibold ${c.ai ? 'text-[#3182F6]' : STATUS_COLOR[c.state]}`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <span className="text-base font-extrabold tracking-[-0.02em] text-[#191F28]">작성 기준</span>
            <div className="mt-4 flex flex-col gap-3">
              {criteria.map((c) => (
                <div key={c.label} className="flex justify-between text-[15px]">
                  <span className="text-[#6B7684]">{c.label}</span>
                  <span className="font-bold tabular-nums text-[#191F28]">{c.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
            <button
              type="button"
              onClick={onStart}
              disabled={busy || (pre?.blockers.length ?? 0) > 0}
              title={pre?.blockers[0]}
              className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] disabled:cursor-not-allowed disabled:bg-[#C4CBD4]"
            >
              {busy ? '초안 준비 중…' : '보고서 초안 생성'}
            </button>
            <button
              type="button"
              disabled={previewBusy}
              onClick={openPreview}
              className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB] disabled:opacity-60"
            >
              {previewBusy ? '서식 불러오는 중…' : '빈 서식 미리보기'}
            </button>
            {error && (
              <p className="mt-1.5 rounded-lg bg-[#FFF0F0] px-3 py-2 text-[13px] leading-relaxed text-[#E03131]">
                초안을 시작하지 못했습니다 — {error}
              </p>
            )}
            {pre && pre.blockers.length > 0 && (
              <p className="mt-1.5 rounded-lg bg-[#FFF0F0] px-3 py-2 text-[13px] leading-relaxed text-[#E03131]">
                지금 만들면 서식이 빕니다 — {pre.blockers.join(' · ')}
              </p>
            )}
            {preflight.state.status === 'error' && (
              <p className="mt-1.5 flex items-center gap-2 rounded-lg bg-[#FFFBF2] px-3 py-2 text-[13px] leading-relaxed text-[#B45309]">
                사전 점검을 불러오지 못했습니다.
                <button
                  type="button"
                  onClick={preflight.reload}
                  className="font-bold underline underline-offset-2"
                >
                  다시 시도
                </button>
              </p>
            )}
            {indicators.state.status === 'error' && (
              <p className="mt-1.5 flex items-center gap-2 rounded-lg bg-[#FFF0F0] px-3 py-2 text-[13px] leading-relaxed text-[#E03131]">
                실적 집계를 불러오지 못했습니다.
                <button
                  type="button"
                  onClick={indicators.reload}
                  className="font-bold underline underline-offset-2"
                >
                  다시 시도
                </button>
              </p>
            )}
            {previewError && (
              <p className="mt-1.5 rounded-lg bg-[#FFF0F0] px-3 py-2 text-[13px] leading-relaxed text-[#E03131]">
                빈 서식을 불러오지 못했습니다 — {previewError}
              </p>
            )}
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B95A1]">{applyMeta.disclaimer}</p>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
