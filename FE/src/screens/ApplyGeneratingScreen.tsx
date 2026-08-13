import { AppLayout } from '../components/AppLayout';
import { applyMeta, generateProgress, generateSteps } from '../mocks/apply';

interface ApplyGeneratingScreenProps {
  onNavigate?: (to: string) => void;
  onCancel?: () => void;
}

/** 06b — 생성 중. 스피너 대신 실제 작업 단계를 순차로 보여준다 */
export function ApplyGeneratingScreen({ onNavigate, onCancel }: ApplyGeneratingScreenProps) {
  return (
    <AppLayout active="subsidy">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#3182F6]">{applyMeta.periodLabel}</span>
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">
          사업계획서를 작성하고 있습니다
        </h1>
        <p className="text-base text-[#6B7684]">
          법정 산식 계산이 먼저 끝나고, 마지막에 AI가 서술 문장을 씁니다.
        </p>
      </header>

      <section className="rounded-[20px] bg-white p-7">
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">
            진행 단계 {generateProgress.current} / {generateProgress.total}
          </span>
          <span className="text-[15px] font-bold tabular-nums text-[#3182F6]">{generateProgress.percent}%</span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F2F4F6]">
          <span
            className="block h-1.5 rounded-full bg-[#3182F6] transition-[width] duration-500"
            style={{ width: `${generateProgress.percent}%` }}
          />
        </div>

        <div className="mt-2 flex flex-col">
          {generateSteps.map((s) => (
            <div
              key={s.label}
              className={[
                'grid grid-cols-[24px_1fr_auto] items-center gap-3.5 border-t border-[#F2F4F6] py-[18px]',
                s.ai ? '-mx-3 rounded-b-xl bg-[#F5F9FF] px-3' : '',
              ].join(' ')}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-extrabold ${
                  s.done ? 'bg-[#15C47E] text-[13px] text-white' : 'bg-[#E8F3FF] text-[11px] text-[#3182F6]'
                }`}
              >
                {s.done ? '✓' : 'AI'}
              </span>

              <span className={`text-base ${s.done ? 'font-semibold text-[#4E5968]' : 'font-bold text-[#191F28]'}`}>
                {s.label}
                {!s.done && (
                  <span className="ml-0.5 text-[#3182F6]">
                    <span className="animate-pulse">·</span>
                    <span className="animate-pulse [animation-delay:200ms]">·</span>
                    <span className="animate-pulse [animation-delay:400ms]">·</span>
                  </span>
                )}
              </span>

              <span
                className={
                  s.done
                    ? 'text-[17px] font-bold tabular-nums tracking-[-0.02em] text-[#191F28]'
                    : 'text-[15px] font-semibold text-[#3182F6]'
                }
              >
                {s.result}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between rounded-2xl bg-white px-6 py-[18px]">
        <span className="text-[15px] text-[#6B7684]">{applyMeta.disclaimer}</span>
        <span className="flex gap-4">
          <button
            type="button"
            onClick={() => onNavigate?.('/subsidy/done')}
            className="text-[15px] font-bold text-[#3182F6]"
          >
            완료 화면 보기 →
          </button>
          <button type="button" onClick={onCancel} className="text-[15px] font-bold text-[#8B95A1]">
            생성 취소
          </button>
        </span>
      </section>
    </AppLayout>
  );
}
