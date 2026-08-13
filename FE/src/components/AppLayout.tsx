import type { ReactNode } from 'react';
import { account } from '../mocks/home';

export type NavKey = 'home' | 'freight' | 'matching' | 'subsidy' | 'settlement';

const NAV: { key: NavKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'freight', label: '화물' },
  { key: 'matching', label: '매칭' },
  { key: 'subsidy', label: '보조금 · ESG 리포트' },
  { key: 'settlement', label: '정산' },
];

interface AppLayoutProps {
  active: NavKey;
  children: ReactNode;
  onNavigate?: (key: NavKey) => void;
}

/** 로그인 후 공통 셸. 사이드바 240px + 콘텐츠 1200px 중앙 정렬 */
export function AppLayout({ active, children, onNavigate }: AppLayoutProps) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-[#F9FAFB] font-['Pretendard',system-ui,sans-serif] antialiased">
      <aside className="flex flex-col gap-[22px] border-r border-[#F2F4F6] bg-white px-4 py-[22px]">
        <div className="flex items-center gap-2 px-2">
          <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[#3182F6] text-sm font-extrabold text-white">
            X
          </span>
          <span className="text-base font-extrabold tracking-[-0.03em] text-[#191F28]">알뜰철도 X</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const on = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate?.(item.key)}
                className={[
                  'rounded-[10px] px-3 py-[11px] text-left text-[15px] transition-colors',
                  on ? 'bg-[#F2F4F6] font-bold text-[#191F28]' : 'font-semibold text-[#6B7684] hover:bg-[#F9FAFB]',
                ].join(' ')}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1.5">
          <button
            type="button"
            className="rounded-[10px] px-3 py-[11px] text-left text-[15px] font-semibold text-[#6B7684] hover:bg-[#F9FAFB]"
          >
            설정
          </button>
          <div className="flex items-center gap-[9px] rounded-xl bg-[#F9FAFB] p-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#191F28] text-[13px] font-bold text-white">
              {account.initial}
            </span>
            <span className="text-sm font-semibold text-[#4E5968]">
              {account.company} · {account.name}
            </span>
          </div>
        </div>
      </aside>

      <div className="flex justify-center px-8 pb-14 pt-9">
        <div className="flex w-[1200px] flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}
