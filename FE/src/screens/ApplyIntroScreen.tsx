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
import { applyMeta, breadcrumb, checklist, type ChecklistItem } from '../mocks/apply';

/** 체크리스트 상태 문구 — 값이 있는 항목만 집계에서 채웁니다. */
function statusOf(item: ChecklistItem, res: EsgIndicatorsResponse | null): string {
  if (!res || !item.statusFrom) return item.status;
  if (item.statusFrom === 'trips') return `운송 실적 ${formatTrips(res.summary.tripCount)} 연동됨`;
  return `계수 ${res.coefficientVersion} 적용`;
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

  const criteria = [
    {
      label: '대상 기간',
      value: res ? `${formatDocDate(res.period.from)} ~ ${formatDocDate(res.period.to)}` : '집계 중…',
    },
    {
      label: '전환 운송 실적',
      value: res ? `${formatTrips(res.summary.tripCount)} · ${formatTon(res.summary.totalTon)}` : '집계 중…',
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
          {res ? `${res.period.label} 실적 기준` : '실적을 집계하는 중…'}
        </span>
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">{applyMeta.title}</h1>
        <p className="text-base text-[#6B7684]">{applyMeta.legalBasis}</p>
      </header>

      <section className="grid grid-cols-[1fr_380px] items-start gap-4">
        <div className="rounded-[20px] bg-white px-7 pb-6 pt-7">
          <div className="flex items-center justify-between">
            <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">무엇이 만들어지나요</span>
            <span className="rounded-lg bg-[#F2F4F6] px-[11px] py-1.5 text-[13px] font-bold text-[#6B7684]">
              {checklist.length}개 항목
            </span>
          </div>

          <div className="mt-[18px] flex flex-col">
            {checklist.map((c) => (
              <div key={c.title} className="flex items-center gap-3.5 border-t border-[#F2F4F6] py-4">
                <span
                  className={`inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${
                    c.ai ? 'bg-[#E8F3FF] text-[#3182F6]' : 'bg-[#EAF8F1] text-[#12A87A]'
                  }`}
                >
                  {c.ai ? 'AI' : '✓'}
                </span>

                <div className="flex-1">
                  <div className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{c.title}</div>
                  <div className="mt-[3px] text-sm text-[#8B95A1]">{c.desc}</div>
                </div>

                <span className={`text-sm font-semibold ${c.ai ? 'text-[#3182F6]' : 'text-[#4E5968]'}`}>
                  {statusOf(c, res)}
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
              disabled={busy}
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
