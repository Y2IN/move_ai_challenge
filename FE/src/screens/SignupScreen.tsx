import { useState } from 'react';
import { AuthInput } from '../components/AuthCard';
import { orgField, roles, signupCta, type Role } from '../mocks/marketing';

interface SignupScreenProps {
  onSubmit?: (role: Role) => void;
}

/** 02a — 회원가입. 역할을 먼저 고르면 입력 항목과 CTA 문구가 바뀐다 */
export function SignupScreen({ onSubmit }: SignupScreenProps) {
  const [role, setRole] = useState<Role>('corp');
  // 체크를 풀면 실제로 가입 버튼이 잠깁니다 (예전에는 값이 어디에도 쓰이지 않았습니다).
  const [agreed, setAgreed] = useState(true);
  const org = orgField[role];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EDEEF0] p-12">
      {/* 높이 고정 없이 내용만큼 — 카드 안에서 스크롤되지 않게 */}
      <div className="flex w-[620px] flex-col gap-[22px] rounded-[20px] bg-white px-12 pb-10 pt-12 shadow-[0_12px_40px_rgba(25,31,40,0.10)]">
        {/* 실제로 계정이 만들어지지 않는다는 사실과 버튼 동작을 일치시킵니다.
            예전 문구("가입 불가")는 버튼이 정상 진입시켜 서로 모순이었습니다. */}
        <div className="rounded-xl bg-[#FFFBF2] px-4 py-3.5 text-[15px] font-semibold text-[#B45309]">
          이번 버전은 계정 없이 동작합니다 — 가입 정보는 저장되지 않고, 바로 데모 화면으로
          들어갑니다.
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">회원가입</h1>
          <p className="text-base text-[#8B95A1]">먼저 역할을 선택해 주세요</p>
        </div>

        <div className="flex flex-col gap-2.5">
          {roles.map((r) => {
            const on = r.key === role;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={[
                  'rounded-2xl border-2 p-5 text-left transition-colors',
                  on ? 'border-[#3182F6] bg-[#F5F9FF]' : 'border-[#E5E8EB] bg-white',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[17px] font-bold tracking-[-0.02em] text-[#191F28]">{r.label}</span>
                  {on && <span className="text-base font-extrabold text-[#3182F6]">✓</span>}
                </div>
                <div className="mt-1.5 text-[15px] leading-[1.55] text-[#6B7684]">{r.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AuthInput label="이름" placeholder="최현지" />
          <AuthInput label={org.label} placeholder={org.placeholder} />
        </div>

        <AuthInput label="이메일" type="email" placeholder="name@company.co.kr" />
        <AuthInput label="비밀번호" type="password" placeholder="영문, 숫자 포함 8자 이상" />

        <button type="button" onClick={() => setAgreed((v) => !v)} className="flex items-center gap-2.5 text-left">
          <span
            className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-[13px] font-extrabold text-white ${
              agreed ? 'bg-[#3182F6]' : 'bg-[#D1D6DB]'
            }`}
          >
            ✓
          </span>
          <span className="text-[15px] text-[#4E5968]">서비스 이용약관 및 개인정보 처리방침에 동의합니다</span>
        </button>

        <button
          type="button"
          disabled={!agreed}
          onClick={() => onSubmit?.(role)}
          className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] disabled:bg-[#C4CBD4]"
        >
          {signupCta[role]}
        </button>
      </div>
    </div>
  );
}
