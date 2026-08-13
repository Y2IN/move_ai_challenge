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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EDEEF0] p-12 font-['Pretendard',system-ui,sans-serif] antialiased">
      <AuthCard>
        <div className="flex flex-col justify-center gap-[22px] px-16 py-14">
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
            <button type="button">비밀번호 찾기</button>
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
