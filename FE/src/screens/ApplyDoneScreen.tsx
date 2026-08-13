import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ApplyDocument } from '../components/ApplyDocument';
import { DocSheet } from '../components/DocTable';
import { EsgIndicatorTable } from '../components/EsgIndicatorTable';
import type {
  EsgIndicatorsResponse,
  EsgReport,
  EsgSectionKey,
  Scope3Format,
} from '../lib/esg';
import { ESG_DISCLAIMER } from '../lib/esg';
import { applyMeta, panel } from '../mocks/apply';

type DocTab = 'doc' | 'esg';

const TABS: { key: DocTab; label: string }[] = [
  { key: 'doc', label: '전환교통 보조금 사업계획서' },
  { key: 'esg', label: 'K-ESG 지표표' },
];

/** ESG 탭이 그리는 서버 상태. 로드·재생성은 app/subsidy/done/page.tsx 가 담당합니다. */
export interface EsgTabState {
  indicators: EsgIndicatorsResponse | null;
  indicatorsError: string | null;
  report: EsgReport | null;
  reportError: string | null;
  busyKeys: EsgSectionKey[];
}

interface ApplyDoneScreenProps {
  /** 탭 1(사업계획서) 목데이터 문단 재생성 — 아직 미연결 */
  onRegenerate?: (id: string) => void;
  esg: EsgTabState;
  onRegenerateSection: (key: EsgSectionKey) => void;
  onRegenerateAllEsg: () => void;
  onRetryIndicators: () => void;
  onExportScope3: (format: Scope3Format) => void;
}

function EsgTab({
  esg,
  onRegenerateSection,
  onRegenerateAllEsg,
  onRetryIndicators,
}: Pick<ApplyDoneScreenProps, 'esg' | 'onRegenerateSection' | 'onRegenerateAllEsg' | 'onRetryIndicators'>) {
  if (esg.indicatorsError) {
    return (
      <DocSheet minHeight={720}>
        <div className="flex flex-col gap-3">
          <span className="text-sm leading-[1.7] text-[#D22030]">
            K-ESG 지표를 불러오지 못했습니다 — {esg.indicatorsError}
          </span>
          <button
            type="button"
            onClick={onRetryIndicators}
            className="self-start rounded-lg border border-[#D22030] bg-white px-3 py-1.5 text-xs font-bold text-[#D22030]"
          >
            ↻ 다시 시도
          </button>
        </div>
      </DocSheet>
    );
  }

  if (!esg.indicators) {
    return (
      <DocSheet minHeight={720}>
        <div className="flex animate-pulse flex-col gap-4">
          <span className="h-8 w-1/2 self-center rounded bg-[#F2F4F6]" />
          <span className="h-40 w-full rounded bg-[#F2F4F6]" />
          <span className="h-24 w-full rounded bg-[#F2F4F6]" />
        </div>
      </DocSheet>
    );
  }

  return (
    <EsgIndicatorTable
      period={esg.indicators.period}
      shipperName={esg.indicators.shipperName}
      coefficientVersion={esg.indicators.coefficientVersion}
      verified={esg.indicators.verified}
      indicators={esg.indicators.indicators}
      disclaimer={esg.report?.disclaimer ?? ESG_DISCLAIMER}
      sections={esg.report?.sections ?? null}
      generation={esg.report?.generation ?? null}
      generatedAt={esg.report?.generatedAt ?? null}
      reportError={esg.reportError}
      busyKeys={esg.busyKeys}
      onRegenerateSection={onRegenerateSection}
      onRetryReport={onRegenerateAllEsg}
    />
  );
}

/** 06c — 생성 완료. 좌측 문서 프리뷰 + 우측 sticky 산정 패널 */
export function ApplyDoneScreen({
  onRegenerate,
  esg,
  onRegenerateSection,
  onRegenerateAllEsg,
  onRetryIndicators,
  onExportScope3,
}: ApplyDoneScreenProps) {
  const [tab, setTab] = useState<DocTab>('doc');
  const esgActive = tab === 'esg';
  // 리포트 전체가 생성 중이거나(report 없음·에러도 없음) 문단 하나가 도는 동안은 잠급니다.
  const esgBusy = (!esg.report && !esg.reportError) || esg.busyKeys.length > 0;

  return (
    <AppLayout active="subsidy">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-[#EAF8F1] px-[11px] py-1.5 text-[13px] font-bold text-[#12A87A]">
              초안 생성 완료
            </span>
            <span className="text-sm text-[#8B95A1]">{applyMeta.generatedAt}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">{applyMeta.title}</h1>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={esgActive && esgBusy}
            onClick={esgActive ? onRegenerateAllEsg : undefined}
            title={esgActive ? 'K-ESG 서술 문단 5개를 전부 다시 생성합니다' : '사업계획서 연동 예정'}
            className="rounded-[10px] bg-white px-3.5 py-2.5 text-[15px] font-bold text-[#4E5968] disabled:text-[#B0B8C1]"
          >
            전체 재생성
          </button>
          <button type="button" className="rounded-[10px] bg-white px-3.5 py-2.5 text-[15px] font-bold text-[#4E5968]">
            변경 이력
          </button>
        </div>
      </header>

      <section className="grid grid-cols-[1fr_380px] items-start gap-5">
        <div className="flex flex-col gap-3.5">
          <div className="flex gap-1 self-start rounded-xl bg-[#EDEEF0] p-1">
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={[
                    'h-[42px] rounded-[9px] px-[18px] text-[15px] font-bold transition-colors',
                    on ? 'bg-white text-[#191F28]' : 'text-[#8B95A1]',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'doc' ? (
            <ApplyDocument onRegenerate={onRegenerate} />
          ) : (
            <EsgTab
              esg={esg}
              onRegenerateSection={onRegenerateSection}
              onRegenerateAllEsg={onRegenerateAllEsg}
              onRetryIndicators={onRetryIndicators}
            />
          )}
        </div>

        <aside className="sticky top-6 flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <span className="text-base font-extrabold tracking-[-0.02em] text-[#191F28]">보조금 산정</span>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-[14px] border border-[#F2F4F6] bg-[#F9FAFB] p-4">
                <div className="text-[13px] font-bold text-[#8B95A1]">{panel.a.label}</div>
                <div className="mt-2 text-xl font-extrabold tabular-nums tracking-[-0.03em] text-[#8B95A1]">
                  {panel.a.value}
                </div>
                <div className="mt-2 text-xs text-[#B0B8C1]">미채택</div>
              </div>

              <div className="rounded-[14px] border border-[#3182F6] bg-[#F5F9FF] p-4">
                <div className="text-[13px] font-bold text-[#1B64DA]">{panel.b.label}</div>
                <div className="mt-2 text-xl font-extrabold tabular-nums tracking-[-0.03em] text-[#191F28]">
                  {panel.b.value}
                </div>
                <div className="mt-2 inline-block rounded-md bg-[#3182F6] px-2 py-[3px] text-[11px] font-bold text-white">
                  채택
                </div>
              </div>
            </div>

            <div className="mt-[18px] border-t border-[#F2F4F6] pt-[18px]">
              <div className="text-sm font-semibold text-[#6B7684]">{panel.resultLabel}</div>
              <div className="mt-2 text-[34px] font-extrabold tracking-[-0.04em] text-[#191F28]">{panel.result}</div>
              <div className="mt-1.5 text-sm tabular-nums text-[#8B95A1]">{panel.resultKrw}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
            <button
              type="button"
              className={[
                'h-14 rounded-[14px] text-[17px] font-bold transition-colors',
                esgActive ? 'bg-[#F2F4F6] text-[#333D4B] hover:bg-[#E5E8EB]' : 'bg-[#3182F6] text-white hover:bg-[#1B64DA]',
              ].join(' ')}
            >
              HWP 다운로드
            </button>

            <button
              type="button"
              className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB]"
            >
              PDF 다운로드
            </button>

            <button
              type="button"
              onClick={() => onExportScope3('xlsx')}
              title="요약·명세·계수 3시트 XLSX 통합문서"
              className={[
                'h-[52px] rounded-[14px] text-base font-bold transition-colors',
                esgActive ? 'bg-[#3182F6] text-white hover:bg-[#1B64DA]' : 'bg-[#F2F4F6] text-[#333D4B] hover:bg-[#E5E8EB]',
              ].join(' ')}
            >
              Scope 3 데이터 내보내기
            </button>

            <div className="flex items-center justify-center gap-2 text-[13px] font-semibold text-[#4E5968]">
              <button type="button" onClick={() => onExportScope3('csv')} className="underline-offset-2 hover:underline">
                CSV 원자료
              </button>
              <span className="text-[#D1D6DB]">·</span>
              <button type="button" onClick={() => onExportScope3('pdf')} className="underline-offset-2 hover:underline">
                인쇄용 PDF 열기
              </button>
            </div>

            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B95A1]">{panel.caution}</p>
          </div>
        </aside>
      </section>
    </AppLayout>
  );
}
