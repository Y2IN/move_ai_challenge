import { AuthCard } from '../components/AuthCard';
import { roles, type Role } from '../mocks/marketing';

interface DemoEntryScreenProps {
  onEnter?: (role: Role) => void;
  onLogin?: () => void;
}

/** 02a-1 — 해커톤 시연용. 역할만 고르면 바로 입장한다 */
export function DemoEntryScreen({ onEnter, onLogin }: DemoEntryScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EDEEF0] p-4 sm:p-8 lg:p-12">
      <AuthCard>
        <div className="flex flex-col justify-center gap-6 px-6 py-10 sm:px-10 md:px-16 md:py-14">
          <div className="flex flex-col gap-2">
            <span className="self-start rounded-lg bg-[#E8F3FF] px-[11px] py-1.5 text-[13px] font-bold text-[#1B64DA]">
              데모 모드
            </span>
            <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">어떤 역할로 볼까요?</h1>
            <p className="text-base text-[#8B95A1]">계정 없이 바로 둘러볼 수 있습니다</p>
          </div>

          <div className="flex flex-col gap-3">
            {roles.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onEnter?.(r.key)}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#E5E8EB] bg-white px-6 py-[22px] text-left transition-colors hover:border-[#3182F6] hover:bg-[#F5F9FF]"
              >
                <span className="flex flex-col gap-[5px]">
                  <span className="text-lg font-bold tracking-[-0.02em] text-[#191F28]">
                    {r.label}로 들어가기
                  </span>
                  <span className="text-[15px] text-[#6B7684]">{r.demoDesc}</span>
                </span>
                <span className="text-xl font-bold text-[#3182F6]">→</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <span className="h-px flex-1 bg-[#F2F4F6]" />
            <span className="text-sm text-[#B0B8C1]">또는</span>
            <span className="h-px flex-1 bg-[#F2F4F6]" />
          </div>

          <button
            type="button"
            onClick={onLogin}
            className="h-[52px] rounded-[14px] bg-[#F2F4F6] text-base font-bold text-[#333D4B] transition-colors hover:bg-[#E5E8EB]"
          >
            계정으로 로그인
          </button>
        </div>
      </AuthCard>
    </div>
  );
}
