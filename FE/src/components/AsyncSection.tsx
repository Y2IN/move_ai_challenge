import type { ReactNode } from 'react';
import type { AsyncState } from '../lib/use-async';

interface AsyncSectionProps<T> {
  state: AsyncState<T>;
  /** 로딩 중 자리를 지킬 스켈레톤. 없으면 기본 카드 스켈레톤 */
  skeleton?: ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

/**
 * 조회 3상태를 그리는 공통 껍데기. 화면마다 로딩/에러 마크업을 다시 쓰지 않기 위한 것입니다.
 *
 * 에러 문구는 **BE 가 준 문장을 그대로** 보여줍니다 — "등록되지 않은 역 코드입니다"
 * 처럼 뭘 고쳐야 하는지 알려주는 문장이라, 화면에서 뭉뚱그리면 정보가 사라집니다.
 */
export function AsyncSection<T>({ state, skeleton, onRetry, children }: AsyncSectionProps<T>) {
  if (state.status === 'loading') return <>{skeleton ?? <CardSkeleton />}</>;
  if (state.status === 'error') return <ErrorNotice message={state.message} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[20px] bg-white p-7">
      <span className="text-base text-[#D22030]">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[10px] bg-[#3182F6] px-4 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

/** 높이를 실제 카드와 맞춰 두면 로딩→완료에서 레이아웃이 튀지 않습니다. */
export function CardSkeleton({ height = 220 }: { height?: number }) {
  return <div className="animate-pulse rounded-[20px] bg-white" style={{ height }} />;
}

/**
 * 아직 API 가 없어 큐레이션 값으로 그리는 구간에 답니다.
 *
 * 화면에 안 적으면 심사·시연에서 실데이터와 구분이 안 됩니다. 붙일 엔드포인트가
 * 정해져 있으면 `api` 로 함께 적어 두세요 — 그게 다음 작업 목록이 됩니다.
 */
export function DemoDataBadge({ api }: { api?: string }) {
  return (
    <span
      title={api ? `${api} 가 생기면 실데이터로 교체됩니다` : undefined}
      className="inline-flex whitespace-nowrap rounded-lg bg-[#FFF4E0] px-2.5 py-[5px] text-[13px] font-bold text-[#C77700]"
    >
      데모 데이터{api ? ` · ${api} 미구현` : ''}
    </span>
  );
}

export function SkeletonGrid({ count = 4, height = 118 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} height={height} />
      ))}
    </div>
  );
}
