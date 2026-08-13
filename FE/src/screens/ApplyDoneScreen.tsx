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
import type { InputOrigin, ParagraphKey, SubsidyExportFormat } from '../lib/subsidy';
import type { ApplyDocView } from '../lib/subsidy-view';

type DocTab = 'doc' | 'esg';

const SCREEN_TITLE = '전환교통 보조금 사업계획서';

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

/** 사업계획서 탭이 그리는 서버 상태(#31·#33~#36). 로드는 page.tsx 가 담당합니다. */
export interface DocTabState {
  applicationId: string | null;
  doc: ApplyDocView | null;
  error: string | null;
  /** 재생성 중인 문단 — 해당 블록만 잠깁니다 */
  busyKeys: ParagraphKey[];
  /** 전체 재생성 진행 중 */
  regenerating: boolean;
  /**
   * 수치가 실계산인지 고정값인지. `fixture` 면 화면에 그대로 알립니다 —
   * 계산이 죽어도 시연이 되도록 BE 가 조용히 떨어뜨리는 경로가 있습니다.
   */
  inputOrigin: InputOrigin | null;
  inputNote: string | null;
  /** 전체 재생성에서 사용자가 편집해 보존된 문단 */
  keptUserEdits: ParagraphKey[];
}

interface ApplyDoneScreenProps {
  doc: DocTabState;
  onRegenerateParagraph: (key: ParagraphKey) => void;
  onRegenerateAllDoc: () => void;
  onRetryDoc: () => void;
  onExportDoc: (format: SubsidyExportFormat) => void;
  esg: EsgTabState;
  onRegenerateSection: (key: EsgSectionKey) => void;
  onEditSection: (key: EsgSectionKey, text: string) => void;
  onRegenerateAllEsg: () => void;
  onRetryIndicators: () => void;
  onExportScope3: (format: Scope3Format) => void;
}

function DocTab({
  doc,
  onRegenerateParagraph,
  onRetryDoc,
}: Pick<ApplyDoneScreenProps, 'doc' | 'onRegenerateParagraph' | 'onRetryDoc'>) {
  // 문서를 아예 못 받은 경우에만 통째로 에러 화면입니다. 문단 재생성 실패처럼
  // 이미 그려진 문서가 있는 실패는 아래에서 배너로만 알립니다 — 문서를 지우면 안 됩니다.
  if (doc.error && !doc.doc) {
    return (
      <DocSheet minHeight={720}>
        <div className="flex flex-col gap-3">
          <span className="text-sm leading-[1.7] text-[#D22030]">
            사업계획서를 불러오지 못했습니다 — {doc.error}
          </span>
          <button
            type="button"
            onClick={onRetryDoc}
            className="self-start rounded-lg border border-[#D22030] bg-white px-3 py-1.5 text-xs font-bold text-[#D22030]"
          >
            ↻ 다시 시도
          </button>
        </div>
      </DocSheet>
    );
  }

  if (!doc.doc) {
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
    <div className="flex flex-col gap-3">
      {doc.error && (
        <div className="rounded-[10px] border border-[#D22030] bg-[#FFF5F5] px-4 py-3 text-[13px] text-[#D22030]">
          {doc.error} — 아래 문서는 마지막으로 받은 내용입니다.
        </div>
      )}

      {doc.inputOrigin === 'fixture' && (
        <div className="rounded-[10px] border border-[#F2B33D] bg-[#FFF8EB] px-4 py-3 text-[13px] leading-[1.7] text-[#A96A00]">
          <b>고정 예시 수치입니다.</b> 실제 편성·계산에서 값을 만들지 못해 시연용 고정값으로
          채웠습니다{doc.inputNote ? ` — ${doc.inputNote}` : ''}. 이 상태로 제출하면 안 됩니다.
        </div>
      )}

      {doc.keptUserEdits.length > 0 && (
        <div className="rounded-[10px] border border-[#D6E7FF] bg-[#F5F9FF] px-4 py-3 text-[13px] text-[#1B64DA]">
          직접 편집한 문단 {doc.keptUserEdits.length}개는 덮어쓰지 않고 그대로 두었습니다.
        </div>
      )}

      <ApplyDocument
        doc={doc.doc}
        busyKeys={doc.busyKeys}
        onRegenerate={doc.applicationId ? onRegenerateParagraph : undefined}
      />
    </div>
  );
}

function EsgTab({
  esg,
  onRegenerateSection,
  onEditSection,
  onRegenerateAllEsg,
  onRetryIndicators,
}: Pick<
  ApplyDoneScreenProps,
  'esg' | 'onRegenerateSection' | 'onEditSection' | 'onRegenerateAllEsg' | 'onRetryIndicators'
>) {
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
      onEditSection={onEditSection}
      onRetryReport={onRegenerateAllEsg}
    />
  );
}

/** 우측 패널의 A·B 카드. 채택 여부는 BE `result.adopted` 가 정합니다. */
function PanelCard({ card }: { card?: { label: string; value: string; adopted: boolean } }) {
  const adopted = card?.adopted ?? false;
  return (
    <div
      className={[
        'rounded-[14px] border p-4',
        adopted ? 'border-[#3182F6] bg-[#F5F9FF]' : 'border-[#F2F4F6] bg-[#F9FAFB]',
      ].join(' ')}
    >
      <div className={`text-[13px] font-bold ${adopted ? 'text-[#1B64DA]' : 'text-[#8B95A1]'}`}>
        {card?.label ?? '—'}
      </div>
      <div
        className={`mt-2 text-xl font-extrabold tabular-nums tracking-[-0.03em] ${
          adopted ? 'text-[#191F28]' : 'text-[#8B95A1]'
        }`}
      >
        {card?.value ?? '—'}
      </div>
      {adopted ? (
        <div className="mt-2 inline-block rounded-md bg-[#3182F6] px-2 py-[3px] text-[11px] font-bold text-white">
          채택
        </div>
      ) : (
        <div className="mt-2 text-xs text-[#B0B8C1]">미채택</div>
      )}
    </div>
  );
}

/** 06c — 생성 완료. 좌측 문서 프리뷰 + 우측 sticky 산정 패널 */
export function ApplyDoneScreen({
  doc,
  onRegenerateParagraph,
  onRegenerateAllDoc,
  onRetryDoc,
  onExportDoc,
  esg,
  onRegenerateSection,
  onEditSection,
  onRegenerateAllEsg,
  onRetryIndicators,
  onExportScope3,
}: ApplyDoneScreenProps) {
  const [tab, setTab] = useState<DocTab>('doc');
  const esgActive = tab === 'esg';
  // 리포트 전체가 생성 중이거나(report 없음·에러도 없음) 문단 하나가 도는 동안은 잠급니다.
  const esgBusy = (!esg.report && !esg.reportError) || esg.busyKeys.length > 0;
  // 사업계획서도 같은 규칙 — 아직 안 왔거나 문단이 도는 동안은 잠급니다.
  const docBusy = (!doc.doc && !doc.error) || doc.regenerating || doc.busyKeys.length > 0;

  const busy = esgActive ? esgBusy : docBusy;
  const panel = doc.doc?.panel ?? null;
  const headerNote = doc.doc
    ? `${doc.doc.meta.periodLabel} · ${doc.doc.meta.generatedAt}`
    : doc.error
      ? '불러오지 못했습니다'
      : '불러오는 중…';

  return (
    <AppLayout active="subsidy">
      <header className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-[#EAF8F1] px-[11px] py-1.5 text-[13px] font-bold text-[#12A87A]">
              초안 생성 완료
            </span>
            <span className="text-sm text-[#8B95A1]">{headerNote}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">{SCREEN_TITLE}</h1>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={esgActive ? onRegenerateAllEsg : onRegenerateAllDoc}
            title={
              esgActive
                ? 'K-ESG 서술 문단 5개를 전부 다시 생성합니다'
                : '사업계획서 서술 문단 6개를 전부 다시 생성합니다 (직접 편집한 문단은 보존)'
            }
            className="rounded-[10px] bg-white px-3.5 py-2.5 text-[15px] font-bold text-[#4E5968] disabled:text-[#B0B8C1]"
          >
            전체 재생성
          </button>
          {/* #38 라우트는 있지만 이력 화면이 아직 없습니다. 눌리는 척하지 않게 잠가 둡니다. */}
          <button
            type="button"
            disabled
            title="준비 중 — 변경 이력 화면 연동 예정"
            className="rounded-[10px] bg-white px-3.5 py-2.5 text-[15px] font-bold text-[#B0B8C1]"
          >
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
            <DocTab doc={doc} onRegenerateParagraph={onRegenerateParagraph} onRetryDoc={onRetryDoc} />
          ) : (
            <EsgTab
              esg={esg}
              onRegenerateSection={onRegenerateSection}
              onEditSection={onEditSection}
              onRegenerateAllEsg={onRegenerateAllEsg}
              onRetryIndicators={onRetryIndicators}
            />
          )}
        </div>

        <aside className="sticky top-6 flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <span className="text-base font-extrabold tracking-[-0.02em] text-[#191F28]">보조금 산정</span>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <PanelCard card={panel?.a} />
              <PanelCard card={panel?.b} />
            </div>

            <div className="mt-[18px] border-t border-[#F2F4F6] pt-[18px]">
              <div className="text-sm font-semibold text-[#6B7684]">{panel?.resultLabel ?? '보조금 산정 결과'}</div>
              <div className="mt-2 text-[34px] font-extrabold tracking-[-0.04em] text-[#191F28]">
                {panel?.result ?? '—'}
              </div>
              <div className="mt-1.5 text-sm tabular-nums text-[#8B95A1]">{panel?.resultKrw ?? ''}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[20px] bg-white p-6">
            {/* HWP 는 BE 가 501 을 돌려줍니다 — 한글 문서 생성에 쓸 오픈소스가 없습니다. */}
            <button
              type="button"
              disabled
              title="준비 중 — 한글 문서 생성 라이브러리가 없어 PDF 인쇄로 대체합니다"
              className="h-14 rounded-[14px] bg-[#F2F4F6] text-[17px] font-bold text-[#B0B8C1]"
            >
              HWP 다운로드 · 준비 중
            </button>

            <button
              type="button"
              disabled={!doc.applicationId}
              onClick={() => onExportDoc('pdf')}
              title="서식 HTML 을 새 탭에서 열고 인쇄 대화상자를 띄웁니다"
              className={[
                'h-[52px] rounded-[14px] text-base font-bold transition-colors disabled:bg-[#F2F4F6] disabled:text-[#B0B8C1]',
                esgActive
                  ? 'bg-[#F2F4F6] text-[#333D4B] hover:bg-[#E5E8EB]'
                  : 'bg-[#3182F6] text-white hover:bg-[#1B64DA]',
              ].join(' ')}
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

            {panel && <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B95A1]">{panel.caution}</p>}
          </div>
        </aside>
      </section>
    </AppLayout>
  );
}
