import type { ReactNode } from 'react';

/** 관공서 서식 표. 실선 테두리 + 회색 헤더 */
export function DocTable({ children }: { children: ReactNode }) {
  return <div className="border border-[#B0B8C1] text-sm">{children}</div>;
}

export function DocRow({
  cols,
  children,
  head,
  total,
  accent,
}: {
  cols: string;
  children: ReactNode;
  head?: boolean;
  total?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'grid border-b border-[#D1D6DB] last:border-b-0',
        head ? 'bg-[#F2F4F6] font-bold text-[#4E5968]' : 'text-[#191F28]',
        total ? 'bg-[#F9FAFB] font-extrabold' : '',
        accent ? 'bg-[#F5F9FF] font-extrabold' : '',
      ].join(' ')}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export function DocCell({
  children,
  right,
  last,
  label,
  span,
  className = '',
}: {
  children?: ReactNode;
  right?: boolean;
  /** 오른쪽 세로선 제거 */
  last?: boolean;
  /** 라벨 셀 (회색 배경) */
  label?: boolean;
  span?: number;
  className?: string;
}) {
  return (
    <span
      className={[
        'px-[13px] py-[11px]',
        last ? '' : 'border-r border-[#D1D6DB]',
        right ? 'text-right' : '',
        label ? 'bg-[#F2F4F6] font-bold text-[#4E5968]' : '',
        className,
      ].join(' ')}
      style={span ? { gridColumn: `span ${span}` } : undefined}
    >
      {children}
    </span>
  );
}

/** 자동 산출 수치임을 나타내는 회색 산식 배지 */
export function FormulaBadge({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return (
    <span
      className={`rounded-md bg-[#F2F4F6] px-2 py-[3px] text-xs font-semibold text-[#6B7684] ${
        numeric ? 'tabular-nums' : ''
      }`}
    >
      {children}
    </span>
  );
}

export function DocSectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">{children}</div>;
}

/** 문서 상단 안내 + 범례 */
export function DocLegend({ note }: { note: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] bg-[#F9FAFB] px-4 py-3">
      <span className="flex-1 text-[13px] font-bold text-[#4E5968]">{note}</span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7684]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[#E5E8EB]" />
        자동 산출 수치
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7684]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[#D6E7FF]" />
        AI 서술
      </span>
    </div>
  );
}

/** AI가 쓴 서술 문단. hover 시 재생성 칩이 뜬다 */
export function AiParagraphBlock({
  body,
  onRegenerate,
  className = '',
}: {
  body: string;
  onRegenerate?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`group relative rounded-r-[10px] border-l-[3px] border-[#3182F6] bg-[#F5F9FF] px-[18px] pb-4 pt-3.5 ${className}`}
    >
      <div className="flex items-center gap-[7px]">
        <span className="inline-flex h-4 items-center justify-center rounded bg-[#D6E7FF] px-1.5 text-[10px] font-extrabold tracking-wide text-[#1B64DA]">
          AI
        </span>
        <span className="text-[11px] font-bold text-[#1B64DA]">AI 서술 · 편집 가능</span>
      </div>

      <p className="mt-2 text-sm leading-[1.85] text-[#333D4B]">{body}</p>

      <button
        type="button"
        onClick={onRegenerate}
        className="absolute right-3.5 top-3 rounded-lg border border-[#D6E7FF] bg-white px-2.5 py-[5px] text-xs font-bold text-[#3182F6] opacity-0 transition-opacity group-hover:opacity-100"
      >
        ↻ 문단 재생성
      </button>
    </div>
  );
}

/** A4 비율 문서 용지 */
export function DocSheet({ children, minHeight = 1120 }: { children: ReactNode; minHeight?: number }) {
  return (
    <div
      className="flex w-full flex-col gap-[26px] rounded-md border border-[#E5E8EB] bg-white px-[60px] pb-16 pt-14 shadow-[0_8px_28px_rgba(25,31,40,0.07)]"
      style={{ minHeight }}
    >
      {children}
    </div>
  );
}
