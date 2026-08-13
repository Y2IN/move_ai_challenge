import { AppLayout } from '../components/AppLayout';
import { applyMeta, breadcrumb, checklist, criteria } from '../mocks/apply';

interface ApplyIntroScreenProps {
  onNavigate?: (to: string) => void;
  onBack?: () => void;
}

/** 06a — 보조금 신청서 생성 전 */
export function ApplyIntroScreen({ onNavigate, onBack }: ApplyIntroScreenProps) {
  return (
    <AppLayout active="subsidy">
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

        <span className="text-sm font-bold text-[#3182F6]">{applyMeta.periodLabel}</span>
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
              onClick={() => onNavigate?.('/subsidy/generating')}
              className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              보고서 초안 생성
            </button>
            <button
              type="button"
              className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB]"
            >
              빈 서식 미리보기
            </button>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B95A1]">{applyMeta.disclaimer}</p>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
