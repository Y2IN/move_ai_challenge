'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { account } from '../mocks/home';

export type NavKey = 'home' | 'freight' | 'matching' | 'subsidy' | 'settlement';

const NAV: { key: NavKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'freight', label: '화물' },
  { key: 'matching', label: '매칭' },
  { key: 'subsidy', label: '보조금 · ESG 리포트' },
  { key: 'settlement', label: '정산' },
];

/**
 * 메뉴별 기본 경로. 값이 없으면 '준비 중'으로 비활성.
 * ponytail: 매칭·보조금은 원래 상태 분기(04c/04d/04e · 06a/06c)지만
 * 시연 기준 상태를 상수로 박았다. 상태가 생기면 여기만 함수로 바꾸면 된다.
 */
const NAV_PATH: Record<NavKey, string | null> = {
  home: '/home',
  freight: '/freight/new',
  matching: '/matching/negotiation',
  subsidy: '/subsidy/done',
  settlement: null,
};

interface AppLayoutProps {
  active: NavKey;
  children: ReactNode;
  onNavigate?: (key: NavKey) => void;
}

/** 로그인 후 공통 셸. 사이드바 240px + 콘텐츠 1200px 중앙 정렬 */
export function AppLayout({ active, children, onNavigate }: AppLayoutProps) {
  const router = useRouter();
  const go = onNavigate ?? ((key: NavKey) => router.push(NAV_PATH[key]!));

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
            const ready = NAV_PATH[item.key] !== null;
            return (
              <button
                key={item.key}
                type="button"
                disabled={!ready}
                title={ready ? undefined : '준비 중'}
                onClick={() => go(item.key)}
                className={[
                  'flex items-center justify-between rounded-[10px] px-3 py-[11px] text-left text-[15px] transition-colors',
                  !ready
                    ? 'cursor-not-allowed font-semibold text-[#C4CAD1]'
                    : on
                      ? 'bg-[#F2F4F6] font-bold text-[#191F28]'
                      : 'font-semibold text-[#6B7684] hover:bg-[#F9FAFB]',
                ].join(' ')}
              >
                {item.label}
                {!ready && <span className="text-[11px] font-semibold text-[#C4CAD1]">준비 중</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1.5">
          <button
            type="button"
            disabled
            title="준비 중"
            className="flex cursor-not-allowed items-center justify-between rounded-[10px] px-3 py-[11px] text-left text-[15px] font-semibold text-[#C4CAD1]"
          >
            설정
            <span className="text-[11px] font-semibold text-[#C4CAD1]">준비 중</span>
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
