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
  error,
  id,
  highlight,
  children,
}: {
  label: string;
  ai?: boolean;
  /** 서버(#11)와 같은 규칙으로 화면이 먼저 거른 메시지 */
  error?: string;
  /** 다른 곳(파싱 결과 패널)에서 이 칸으로 스크롤·포커스할 때 쓰는 앵커 */
  id?: string;
  /** 잠깐 테두리를 켜서 "여기" 라고 알려줍니다 */
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      id={id}
      className={`flex flex-col gap-2 rounded-xl transition-shadow duration-500 ${
        highlight ? 'shadow-[0_0_0_3px_rgba(49,130,246,0.35)]' : ''
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-[#6B7684]">
        {label}
        {ai && <AiBadge />}
      </span>
      {children}
      {error && <span className="text-[13px] font-semibold text-[#D22030]">{error}</span>}
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

/**
 * 표시값과 전송값이 다른 셀렉트 — 역 목록처럼 라벨은 "울산화물역", 값은 코드
 * ("ULS-FRT")인 경우. 자유 입력을 두면 BE 가 등록되지 않은 역 코드로 400 을
 * 돌려주므로, 고를 수 있는 것만 보여줍니다.
 */
export function ChoiceField({
  value,
  options,
  onChange,
  placeholder = '선택하세요',
  disabled,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} cursor-pointer appearance-none disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#B0B8C1]`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
