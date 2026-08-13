import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ApplyDocument } from '../components/ApplyDocument';
import { EsgIndicatorTable } from '../components/EsgIndicatorTable';
import { applyMeta, panel } from '../mocks/apply';

type DocTab = 'doc' | 'esg';

const TABS: { key: DocTab; label: string }[] = [
  { key: 'doc', label: '전환교통 보조금 사업계획서' },
  { key: 'esg', label: 'K-ESG 지표표' },
];

interface ApplyDoneScreenProps {
  onRegenerate?: (id: string) => void;
}

/** 06c — 생성 완료. 좌측 문서 프리뷰 + 우측 sticky 산정 패널 */
export function ApplyDoneScreen({ onRegenerate }: ApplyDoneScreenProps) {
  const [tab, setTab] = useState<DocTab>('doc');
  const esgActive = tab === 'esg';

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
          <button type="button" className="rounded-[10px] bg-white px-3.5 py-2.5 text-[15px] font-bold text-[#4E5968]">
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
            <EsgIndicatorTable onRegenerate={onRegenerate} />
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
              className={[
                'h-[52px] rounded-[14px] text-base font-bold transition-colors',
                esgActive ? 'bg-[#3182F6] text-white hover:bg-[#1B64DA]' : 'bg-[#F2F4F6] text-[#333D4B] hover:bg-[#E5E8EB]',
              ].join(' ')}
            >
              Scope 3 데이터 내보내기
            </button>

            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B95A1]">{panel.caution}</p>
          </div>
        </aside>
      </section>
    </AppLayout>
  );
}
