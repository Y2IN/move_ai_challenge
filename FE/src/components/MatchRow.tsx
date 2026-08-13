import type { MatchRowData } from '../lib/dashboard';
import { LoadBar, StatusBadge } from './StatusBadge';

const GRID = 'grid grid-cols-[1fr_90px_132px_128px_100px_24px] items-center gap-3';

interface MatchRowProps {
  row: MatchRowData;
  open: boolean;
  onToggle: (id: string) => void;
}

export function MatchRowHeader() {
  return (
    <div className={`${GRID} px-5 py-2.5 text-[13px] font-bold text-[#B0B8C1]`}>
      <span>노선 · 합적 화주</span>
      <span>물량</span>
      <span>적재율</span>
      <span>상태</span>
      <span className="text-right">운송비</span>
      <span />
    </div>
  );
}

export function MatchRow({ row, open, onToggle }: MatchRowProps) {
  return (
    <div className="overflow-hidden rounded-[14px]">
      <button
        type="button"
        onClick={() => onToggle(row.id)}
        className={`${GRID} w-full px-5 py-4 text-left hover:bg-[#F9FAFB]`}
      >
        <span className="flex flex-col gap-[5px]">
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-bold tracking-[-0.02em] text-[#191F28]">{row.route}</span>
            <span className="text-[13px] font-semibold tabular-nums text-[#B0B8C1]">{row.wagon}</span>
          </span>
          <span className="text-sm text-[#8B95A1]">{row.sub}</span>
        </span>

        <span className="text-base font-semibold tabular-nums text-[#4E5968]">{row.tons}</span>

        <LoadBar load={row.load} />

        <span className="justify-self-start">
          <StatusBadge tone={row.tone} />
        </span>

        <span className="text-right text-base font-bold tabular-nums text-[#3182F6]">{row.saving}</span>

        <span className="text-right text-[15px] text-[#B0B8C1]">{open ? '⌃' : '⌄'}</span>
      </button>

      {/* 상세(#9)는 펼칠 때 받아 옵니다. 도착 전에는 자리만 지킵니다. */}
      {open && (
        <div className="mx-3 mb-2.5 grid grid-cols-4 gap-4 rounded-[14px] bg-[#F9FAFB] px-5 py-[18px]">
          {row.detail
            ? row.detail.map((d) => (
                <div key={d.k} className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-[#8B95A1]">{d.k}</span>
                  <span className="text-base font-bold tracking-[-0.02em] text-[#333D4B]">{d.v}</span>
                </div>
              ))
            : Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <span className="h-3 w-14 animate-pulse rounded bg-[#E5E8EB]" />
                  <span className="h-4 w-20 animate-pulse rounded bg-[#E5E8EB]" />
                </div>
              ))}
        </div>
      )}

      <div className="mx-5 h-px bg-[#F2F4F6]" />
    </div>
  );
}
