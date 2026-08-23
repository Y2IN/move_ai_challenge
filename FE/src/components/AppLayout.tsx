'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, type Account } from '../lib/account';
import type { Role } from '../mocks/marketing';
import { getRole } from '../lib/role';

export type NavKey =
  | 'home'
  | 'freight'
  | 'matching'
  | 'subsidy'
  | 'settlement'
  | 'wagons'
  | 'clients'
  | 'performance';

const NAV_LABEL: Record<NavKey, string> = {
  home: '홈',
  freight: '화물',
  matching: '매칭',
  subsidy: '보조금 · ESG 리포트',
  settlement: '정산',
  wagons: '공차 관리',
  clients: '화주 · 영업',
  performance: '수송 실적',
};

/** 역할별 사이드바 구성. 기업=수요자 / 코레일=공급자 */
const NAV_BY_ROLE: Record<Role, NavKey[]> = {
  corp: ['home', 'freight', 'matching', 'subsidy', 'settlement'],
  korail: ['home', 'wagons', 'clients', 'performance'],
};

/**
 * 메뉴별 기본 경로. 값이 없으면 '준비 중'으로 비활성.
 * ponytail: 시연 기준 상태를 상수로 박았다. clients·performance는 화면이 생기면 경로만 채우면 활성화된다.
 *
 * ⚠️ 메뉴의 기본 경로는 **LLM 을 태우지 않는 화면**이어야 한다. 예전에는
 *    매칭 → /matching/negotiation, 보조금 → /subsidy/done 이라 메뉴를 누를
 *    때마다 조율 실행·문단 생성이 새로 나갔다 (누를 때마다 과금·수 초 대기).
 *    LLM 을 타는 화면은 사용자가 그 화면의 버튼으로 명시적으로 들어간다.
 */
const NAV_PATH: Record<NavKey, string | null> = {
  home: '/home',
  freight: '/freight/new',
  matching: '/matching/unmatched',
  subsidy: '/subsidy/new',
  settlement: '/settlement',
  wagons: '/korail/wagons',
  clients: '/korail/clients',
  performance: '/korail/performance',
};

interface AppLayoutProps {
  active: NavKey;
  children: ReactNode;
  /** 명시하면 그 역할 메뉴. 없으면 로그인 시 저장된 역할을 읽는다 */
  role?: Role;
  onNavigate?: (key: NavKey) => void;
  /**
   * 이미 계정을 받아 둔 화면(홈)만 넘긴다. 없으면 이 컴포넌트가 역할에 맞는
   * 계정을 #4 로 직접 받는다 — 회사명·담당자를 상수로 박아 두지 않기 위한 것.
   */
  account?: Account | null;
}

/** 로그인 후 공통 셸. 사이드바 240px + 콘텐츠 1200px 중앙 정렬 */
export function AppLayout({
  active,
  children,
  role: roleProp,
  onNavigate,
  account: accountProp,
}: AppLayoutProps) {
  const router = useRouter();
  const [storedRole, setStoredRole] = useState<Role>('corp');
  useEffect(() => setStoredRole(getRole()), []);
  const role = roleProp ?? storedRole;
  const navKeys = NAV_BY_ROLE[role];

  // 위에서 내려준 계정이 있으면 그걸 쓴다 (같은 값을 두 번 받지 않는다).
  const fetched = useAccount(role);
  const account = accountProp ?? fetched;
  const go = onNavigate ?? ((key: NavKey) => router.push(NAV_PATH[key]!));

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-[#F9FAFB]">
      {/* 랜딩('/') 상단바와 같은 다크 팔레트 */}
      {/* h-screen으로 stretch를 끊어야 sticky가 먹고, 프로필이 문서 끝이 아닌 화면 하단에 고정된다 */}
      <aside className="sticky top-0 flex h-screen flex-col gap-[22px] overflow-y-auto bg-[#0B1220] px-4 py-[22px]">
        <div className="flex items-center gap-2 px-2">
          <img src="/train.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="text-base font-extrabold tracking-[-0.03em] text-white">알뜰철도 X</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {navKeys.map((key) => {
            const on = key === active;
            const ready = NAV_PATH[key] !== null;
            return (
              <button
                key={key}
                type="button"
                disabled={!ready}
                title={ready ? undefined : '준비 중'}
                onClick={() => go(key)}
                className={[
                  'flex items-center justify-between rounded-[10px] px-3 py-[11px] text-left text-[15px] transition-colors',
                  !ready
                    ? 'cursor-not-allowed font-semibold text-white/25'
                    : on
                      ? 'bg-white/10 font-bold text-white'
                      : 'font-semibold text-[#8B95A1] hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
              >
                {NAV_LABEL[key]}
                {!ready && <span className="text-[11px] font-semibold text-white/25">준비 중</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1.5">
          <button
            type="button"
            disabled
            title="준비 중"
            className="flex cursor-not-allowed items-center justify-between rounded-[10px] px-3 py-[11px] text-left text-[15px] font-semibold text-white/25"
          >
            설정
            <span className="text-[11px] font-semibold text-white/25">준비 중</span>
          </button>
          <div className="flex items-center gap-[9px] rounded-xl bg-white/[0.07] p-2">
            {/* 아바타는 다크 배경에 묻히지 않게 브랜드 블루로 */}
            <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#3182F6] text-[13px] font-bold text-white">
              {account?.initial ?? ''}
            </span>
            {/* 계정이 오기 전엔 자리만 지킨다 — 임시 이름을 띄우면 잠깐 다른 사람이 찍힌다 */}
            <span className="flex min-w-0 flex-col leading-tight">
              {account ? (
                <>
                  <span className="truncate text-[13px] text-[#8B95A1]">{account.org}</span>
                  <span className="truncate text-sm font-semibold text-[#D1D6DB]">{account.name}</span>
                </>
              ) : (
                <>
                  <span className="h-[15px] w-20 animate-pulse rounded bg-white/10" />
                  <span className="mt-0.5 h-4 w-14 animate-pulse rounded bg-white/10" />
                </>
              )}
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
