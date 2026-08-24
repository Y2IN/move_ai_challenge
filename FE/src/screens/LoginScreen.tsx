import { useState } from 'react';
import { AuthCard, AuthInput } from '../components/AuthCard';
import { loginCta, roles, type Role } from '../mocks/marketing';

interface LoginScreenProps {
  onLogin?: (role: Role) => void;
  onDemo?: () => void;
  onSignup?: () => void;
}

/** 02a — 로그인 (역할 분기) */
export function LoginScreen({ onLogin, onDemo, onSignup }: LoginScreenProps) {
  const [role, setRole] = useState<Role>('corp');
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EDEEF0] p-4 sm:p-8 lg:p-12">
      {/* 인증이 데모 범위 밖이라 재설정 메일을 보낼 곳이 없습니다. 그 사실을 그대로 알립니다. */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="flex w-[420px] flex-col gap-3 rounded-2xl bg-white p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold tracking-[-0.03em] text-[#191F28]">
              비밀번호 재설정은 아직 없습니다
            </h2>
            <p className="text-[15px] leading-relaxed text-[#4E5968]">
              이번 버전은 계정·인증 없이 동작합니다. 로그인 폼은 화면 흐름을 보여주기 위한
              것이고, 실제 계정이 만들어지지 않으므로 재설정할 비밀번호도 없습니다.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setHelpOpen(false);
                  onDemo?.();
                }}
                className="h-12 flex-1 rounded-xl bg-[#3182F6] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
              >
                데모 계정으로 둘러보기
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="h-12 rounded-xl border border-[#E5E8EB] px-5 text-base font-bold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      <AuthCard>
        <div className="flex flex-col justify-center gap-[22px] px-6 py-10 sm:px-10 md:px-16 md:py-14">
          <div className="rounded-xl bg-[#F5F9FF] px-4 py-3.5 text-[15px] leading-[1.55] text-[#1B64DA]">
            계정 없이 <b className="font-bold">데모 계정으로 둘러보기</b>로 바로 확인하실 수 있습니다.
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">로그인</h1>
            <p className="text-base text-[#8B95A1]">역할에 따라 보이는 화면이 달라집니다</p>
          </div>

          <div className="flex gap-1 rounded-xl bg-[#F2F4F6] p-1">
            {roles.map((r) => {
              const on = r.key === role;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  className={[
                    'h-[46px] flex-1 rounded-[9px] text-[15px] font-bold transition-colors',
                    on ? 'bg-white text-[#191F28]' : 'text-[#8B95A1]',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <AuthInput label="이메일" type="email" placeholder="name@company.co.kr" />
          <AuthInput label="비밀번호" type="password" placeholder="••••••••" />

          <div className="mt-1.5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onLogin?.(role)}
              className="h-14 rounded-[14px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              {loginCta[role]}
            </button>
            <button
              type="button"
              onClick={onDemo}
              className="h-14 rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB]"
            >
              데모 계정으로 둘러보기
            </button>
          </div>

          <div className="flex justify-between text-[15px] text-[#8B95A1]">
            <button type="button" onClick={() => setHelpOpen(true)}>
              비밀번호 찾기
            </button>
            <span>
              아직 계정이 없으신가요?{' '}
              <button type="button" onClick={onSignup} className="font-bold text-[#3182F6]">
                회원가입
              </button>
            </span>
          </div>
        </div>
      </AuthCard>
    </div>
  );
}
