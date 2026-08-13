'use client';

import type { ReactNode } from 'react';
import { cumulativeLines, usePublicStats } from '../lib/landing';
import { brand } from '../mocks/marketing';

/** 02 로그인 · 회원가입 좌측 브랜드 패널 */
export function AuthBrandPanel() {
  const stats = usePublicStats();
  return (
    // 랜딩('/') 다크 히어로와 같은 팔레트
    <div className="flex flex-col justify-between bg-[#0B1220] px-10 py-11">
      <div className="flex items-center gap-2">
        <img src="/train.png" alt="" width={28} height={28} className="rounded-lg" />
        <span className="text-[17px] font-extrabold tracking-[-0.03em] text-white">{brand.name}</span>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-3xl font-extrabold leading-[1.35] tracking-[-0.035em] text-white">
          철도를 채우는 순간,
          <br />
          ESG가 완성됩니다
        </h2>
        <p className="text-base leading-[1.62] text-[#B0B8C1]">{brand.subheadline}</p>
      </div>

      <div className="flex flex-col gap-2.5 text-[15px] text-[#8B95A1]">
        {stats.status === 'ready' ? (
          cumulativeLines(stats.data).map((s) => (
            <span key={s.label}>
              {s.label} <b className="text-white">{s.value}</b>
            </span>
          ))
        ) : (
          // 값이 없을 때 옛 상수를 대신 띄우지 않습니다 — 자리만 지킵니다
          <span className="h-[46px]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

/** 인증 화면 카드 셸. 1040 × 720 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-[720px] w-[1040px] grid-cols-[420px_1fr] overflow-hidden rounded-[20px] bg-white shadow-[0_12px_40px_rgba(25,31,40,0.10)]">
      <AuthBrandPanel />
      {children}
    </div>
  );
}

export function AuthInput({
  label,
  type = 'text',
  placeholder,
}: {
  label: string;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[#6B7684]">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="h-14 rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] px-4 text-base text-[#191F28] outline-none transition-colors focus:border-[#3182F6] focus:bg-white"
      />
    </label>
  );
}
