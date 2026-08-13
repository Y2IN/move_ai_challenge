import { TONE_LABEL, type MatchTone } from '../lib/dashboard';

/** 톤은 BE 의 편성 상태(done · group · wait)와 1:1 입니다. */
const TONE_CLASS: Record<MatchTone, string> = {
  done: 'bg-[#E8F3FF] text-[#1B64DA]',
  group: 'bg-[#FFF4E0] text-[#C77700]',
  wait: 'bg-[#F2F4F6] text-[#6B7684]',
};

export function StatusBadge({
  tone,
  label,
  small,
}: {
  tone: MatchTone;
  label?: string;
  /** 촘촘한 표에서 쓰는 축소 배지 */
  small?: boolean;
}) {
  const size = small ? 'px-2 py-1 text-[11px]' : 'px-[11px] py-1.5 text-[13px]';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-lg font-bold ${size} ${TONE_CLASS[tone]}`}>
      {label ?? TONE_LABEL[tone]}
    </span>
  );
}

/** 적재율 바. 85% 이상 초록, 60% 이상 파랑, 미만 회색 */
export function LoadBar({ load }: { load: number }) {
  const color = load >= 85 ? 'bg-[#15C47E]' : load >= 60 ? 'bg-[#3182F6]' : 'bg-[#B0B8C1]';
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold tabular-nums text-[#4E5968]">{load}%</span>
      <span className="block h-[5px] overflow-hidden rounded-full bg-[#E5E8EB]">
        <span className={`block h-[5px] rounded-full ${color}`} style={{ width: `${load}%` }} />
      </span>
    </div>
  );
}
