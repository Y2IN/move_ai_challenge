import { AppLayout } from '../components/AppLayout';
import { applyMeta, type GenerateStep } from '../mocks/apply';

export interface GenerateProgress {
  current: number;
  total: number;
  percent: number;
}

interface ApplyGeneratingScreenProps {
  /** 서버가 보내온 단계. 계산 4단계 + AI 서술 1단계 */
  steps: GenerateStep[];
  progress: GenerateProgress;
  /** 생성이 실패했을 때의 안내. null 이면 정상 진행 중 */
  error?: string | null;
  /** 완료됐거나 실패해서 결과 화면으로 넘어갈 수 있는 상태인가 */
  finished?: boolean;
  onViewResult?: () => void;
  onCancel?: () => void;
}

/**
 * 06b — 생성 중. 스피너 대신 실제 작업 단계를 순차로 보여준다.
 *
 * ⚠️ 이 화면은 **표시만** 한다. 진행률은 컨테이너(`app/subsidy/generating/page.tsx`)가
 *    SSE 로 받아 props 로 내려준다. 예전에는 여기서 목업 상수를 그대로 그렸는데,
 *    그러면 "6개 문단 중 4번째" 가 영원히 4번째에 멈춰 있는 가짜 진행률이 된다.
 */
export function ApplyGeneratingScreen({
  steps,
  progress,
  error = null,
  finished = false,
  onViewResult,
  onCancel,
}: ApplyGeneratingScreenProps) {
  return (
    <AppLayout active="subsidy">
      <header className="flex flex-col gap-2">
        {/*
          기간 라벨을 상수로 박지 않습니다 — 이 화면은 조회를 하지 않으므로 스스로
          알 수 없는 값입니다. 대신 1단계(운송 실적 집계)가 실어 보낸 실적을 그대로 씁니다.
        */}
        <span className="text-sm font-bold text-[#3182F6]">
          {steps[0]?.result ? `운송 실적 ${steps[0].result}` : '실적을 집계하는 중…'}
        </span>
        <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">
          {error
            ? '사업계획서 작성을 마치지 못했습니다'
            : finished
              ? '사업계획서 작성이 끝났습니다'
              : '사업계획서를 작성하고 있습니다'}
        </h1>
        <p className="text-base text-[#6B7684]">
          {error ?? '법정 산식 계산이 먼저 끝나고, 마지막에 AI가 서술 문장을 씁니다.'}
        </p>
      </header>

      <section className="rounded-[20px] bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">
            진행 단계 {progress.current} / {progress.total}
          </span>
          <span
            className={`text-[15px] font-bold tabular-nums ${
              error ? 'text-[#8B95A1]' : 'text-[#3182F6]'
            }`}
          >
            {progress.percent}%
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F2F4F6]">
          <span
            className={`block h-1.5 rounded-full transition-[width] duration-500 ${
              error ? 'bg-[#D1D6DB]' : 'bg-[#3182F6]'
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="mt-2 flex flex-col">
          {steps.map((s) => (
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
                {!s.done && !error && (
                  <span className="dot-wave ml-0.5 text-[#3182F6]" aria-hidden="true">
                    <span>·</span>
                    <span>·</span>
                    <span>·</span>
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

      <section className="flex flex-col gap-3 rounded-2xl bg-white px-6 py-[18px] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[15px] text-[#6B7684]">{applyMeta.disclaimer}</span>
        <span className="flex gap-4">
          <button
            type="button"
            onClick={onViewResult}
            disabled={!finished && !error}
            className="text-[15px] font-bold text-[#3182F6] disabled:cursor-not-allowed disabled:text-[#C4CBD4]"
          >
            완료 화면 보기 →
          </button>
          <button type="button" onClick={onCancel} className="text-[15px] font-bold text-[#8B95A1]">
            {finished || error ? '닫기' : '생성 취소'}
          </button>
        </span>
      </section>
    </AppLayout>
  );
}
