import type { ReactNode } from 'react';

const CONTROL =
  'h-[52px] rounded-xl border border-[#E5E8EB] bg-white px-4 text-base text-[#191F28] outline-none transition-colors focus:border-[#3182F6]';

export function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-[#E8F3FF] px-2 py-[3px] text-[11px] font-bold text-[#1B64DA]">
      AI 자동입력
    </span>
  );
}

export function Field({
  label,
  ai,
  children,
}: {
  label: string;
  ai?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-[#6B7684]">
        {label}
        {ai && <AiBadge />}
      </span>
      {children}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'date';
  numeric?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} ${numeric ? 'tabular-nums' : ''}`}
    />
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`${CONTROL} cursor-pointer appearance-none`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
