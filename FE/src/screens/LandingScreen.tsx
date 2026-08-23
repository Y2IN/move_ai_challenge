'use client';

import { useEffect, useRef, useState } from 'react';
import { AgentFlowCard, EsgDocPreview, PlanDocPreview } from '../components/DocPreview';
import { AiChip, LandingSection, SectionHeader } from '../components/LandingSection';
import { formatNumber, formatWonSign } from '../lib/format';
import { usePublicStats } from '../lib/landing';
import type { PublicStats } from '../lib/public';
import {
  agentInput,
  agentOutput,
  agentSection,
  brand,
  esgSection,
  howSection,
  heroCaption,
  howItWorks,
  landingCta,
  marketingNav,
} from '../mocks/marketing';

interface LandingScreenProps {
  onLogin?: () => void;
  onStart?: () => void;
}

/** 스크롤 위치에 걸린 섹션의 href를 돌려준다. 어느 섹션도 아니면 빈 문자열 */
function useActiveSection() {
  const [active, setActive] = useState('');
  // 클릭 이동 중인 목적지. 부드러운 스크롤이 지나치는 섹션에 밑줄이 켜지는 걸 막는다
  const jumpTarget = useRef('');

  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // 겹칠 땐 문서 순서상 위쪽 섹션이 이김
        const next = marketingNav.find((n) => visible.has(n.href.slice(1)))?.href ?? '';

        if (jumpTarget.current) {
          if (next !== jumpTarget.current) return; // 아직 이동 중 — 경유 섹션 무시
          jumpTarget.current = ''; // 도착
        }
        setActive(next);
      },
      // 상단바(72px) 아래부터 화면 위 40% 구간에 걸친 섹션만 '현재'로 인정
      { rootMargin: '-72px 0px -60% 0px' },
    );

    for (const n of marketingNav) {
      const el = document.querySelector(n.href);
      if (el) io.observe(el);
    }

    // 사용자가 이동 도중 직접 스크롤해 목적지에 못 닿는 경우의 잠금 해제
    const unlock = () => {
      jumpTarget.current = '';
    };
    document.addEventListener('scrollend', unlock);

    return () => {
      io.disconnect();
      document.removeEventListener('scrollend', unlock);
    };
  }, []);

  return {
    active,
    onJump: (href: string) => {
      jumpTarget.current = href;
      setActive(href); // 밑줄은 클릭 즉시 목적지로
    },
  };
}

/**
 * 히어로 숫자 — 이번 분기 사회환경적 편익 환산액과 편익 항목들.
 *
 * `label`("3억 4,200만")은 서버가 만든 표시 문자열입니다. 화면에서 다시 축약하면
 * 홈 대시보드와 반올림 자리가 어긋납니다.
 *
 * 보조금 예상액이 아닙니다 — 시드 기준으로 전환 추가비용이 음수라 보조금 산정
 * 결과가 "대상 아님"이고, 랜딩에서 보조금을 띄우면 로그인 후 화면과 어긋납니다.
 */
function HeroFigures({ stats }: { stats: PublicStats }) {
  const delta = stats.quarterBenefit.deltaPct;
  const chips = stats.breakdown;

  return (
    <>
      <div className="mt-0.5 flex flex-col items-center">
        {/* 숫자는 흰→블루 그라디언트를 글자에 클립, '원'만 단색 블루로 남김 */}
        <div className="bg-[linear-gradient(180deg,#FFFFFF_38%,#8FC2FF_100%)] bg-clip-text text-[116px] font-extrabold leading-[1.04] tracking-[-0.055em] text-transparent">
          {stats.quarterBenefit.label}
          <span className="ml-3 text-[58px] font-bold tracking-[-0.03em] text-[#8FC2FF]">원</span>
        </div>
        <div className="h-[3px] w-[640px] rounded-full bg-[linear-gradient(90deg,transparent,#3182F6,transparent)]" />
        <div className="mt-3.5 flex items-center gap-2.5">
          <span className="text-base font-semibold tabular-nums text-[#8B95A1]">
            {formatWonSign(stats.quarterBenefit.amount)}
          </span>
          {delta != null && (
            <span className="rounded-full bg-[#15C47E]/[0.16] px-3 py-1.5 text-sm font-bold text-[#34D399]">
              전 분기 대비 {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          )}
        </div>
      </div>

      {/* ponytail: 벨트 폭을 중앙 720px로 고정 — 목록 1벌(약 800px)이 이보다 넓어야 빈칸이 안 생김 */}
      <div className="mx-auto mt-[22px] max-w-[720px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        {/* ponytail: 컨테이너 gap 대신 칩마다 mr-2 — 그래야 -50%가 이음매에 정확히 맞음 */}
        <div className="chip-marquee flex w-max">
          {[...chips, ...chips].map((c, i) => (
            <span
              key={`${c.key}-${i}`}
              className="mr-2 shrink-0 rounded-full bg-white/[0.07] px-[18px] py-[11px] text-[15px] text-[#D1D6DB]"
            >
              {c.label} <b className="ml-1.5 text-white">{c.value}</b>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * 수치가 오기 전/실패했을 때. **옛 상수를 대신 띄우지 않습니다** — 랜딩의 금액은
 * 홈·신청서와 같은 집계라, 여기서만 다른 값을 보여주면 시연 중 바로 어긋납니다.
 */
function HeroPlaceholder() {
  return (
    <div className="mt-0.5 flex flex-col items-center">
      <div className="h-[122px] w-[520px] animate-pulse rounded-3xl bg-white/[0.06]" />
      <div className="mt-3.5 h-[30px] w-[280px] animate-pulse rounded-full bg-white/[0.06]" />
      <div className="mt-[22px] h-[42px] w-[640px] animate-pulse rounded-full bg-white/[0.04]" />
    </div>
  );
}

/** 01 — 로그인 전 서비스 소개 랜딩 */
export function LandingScreen({ onLogin, onStart }: LandingScreenProps) {
  const { active, onJump } = useActiveSection();
  // 히어로 수치·문서 미리보기 금액은 홈 대시보드와 **같은 집계**(#6 ← #7)에서 옵니다.
  const { state: stats, reload: reloadStats } = usePublicStats();
  const statsData = stats.status === 'ready' ? stats.data : null;

  return (
    <div className="min-h-screen bg-white">
      {/* 흰 섹션 위로도 지나가므로 반투명 다크 + blur 고정 */}
      <nav className="sticky top-0 z-50 flex h-[72px] items-center justify-between bg-[#0B1220]/85 px-10 backdrop-blur-md">
        <div className="flex items-center gap-9">
          <div className="flex items-center gap-2">
            {/* ponytail: 26px 정적 아이콘이라 next/image 대신 <img> — 최적화가 벌어줄 게 없음 */}
            <img src="/train.png" alt="" width={28} height={28} className="rounded-lg" />
            <span className="text-[17px] font-extrabold tracking-[-0.03em] text-white">{brand.name}</span>
          </div>
          <div className="flex gap-6 text-[15px] font-semibold">
            {marketingNav.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => onJump(n.href)}
                className={`border-b-2 pb-1 transition-colors ${
                  active === n.href
                    ? 'border-[#3182F6] text-white'
                    : 'border-transparent text-[#8B95A1] hover:text-white'
                }`}
              >
                {n.label}
              </a>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogin}
          className="h-10 rounded-[10px] bg-white/10 px-[18px] text-[15px] font-bold text-white transition-colors hover:bg-white/[0.18]"
        >
          로그인
        </button>
      </nav>

      <section className="bg-[#0B1220] pb-[88px]">
        <div className="flex flex-col items-center gap-[22px] px-10 pt-[76px] text-center">
          <span className="rounded-full bg-[#3182F6]/[0.18] px-[15px] py-2 text-sm font-bold text-[#6FB0FF]">
            {brand.tagline}
          </span>

          <h1 className="text-[42px] font-bold leading-[1.32] tracking-[-0.035em] text-white">
            {brand.headline[0]}
            <br />
            {brand.headline[1]}
          </h1>

          <div className="mt-[34px] text-base font-semibold text-[#8B95A1]">
            {stats.status === 'ready' ? `${stats.data.periodLabel} ${heroCaption}` : heroCaption}
          </div>

          {stats.status === 'ready' ? (
            <HeroFigures stats={stats.data} />
          ) : stats.status === 'error' ? (
            /* 실패를 스켈레톤으로 두면 영원히 로딩처럼 보입니다. 사실대로 적고 재시도를 붙입니다. */
            <div className="mt-[18px] flex flex-col items-start gap-2">
              <span className="text-base font-semibold text-[#D22030]">
                실적 집계를 불러오지 못했습니다.
              </span>
              <button
                type="button"
                onClick={reloadStats}
                className="rounded-lg border border-[#E5E8EB] bg-white px-4 py-2 text-sm font-bold text-[#4E5968] transition-colors hover:bg-[#F9FAFB]"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <HeroPlaceholder />
          )}

          <div className="mt-[30px] flex gap-2.5">
            <button
              type="button"
              onClick={onStart}
              className="h-14 rounded-[14px] bg-[#3182F6] px-[30px] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              {landingCta.button}
            </button>
          </div>

          <div className="mt-[18px] text-[15px] text-[#6B7684]">
            {stats.status === 'ready'
              ? `누적 합적 화주 ${formatNumber(stats.data.cumulative.shippers)}개사 · 채운 공차 ${formatNumber(
                  stats.data.cumulative.filledWagons,
                )}량 · 코레일 공차 노선 실시간 연동`
              : '코레일 공차 노선 실시간 연동'}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-9 px-10 py-20">
        {/* 헤더만이 아니라 카드까지 묶어야 스크롤 스파이가 이 구간 내내 붙어 있음 */}
        <div id="how" className="flex scroll-mt-[92px] flex-col gap-9">
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeader badge={howSection.badge} title={howSection.title} lead={howSection.lead} />
          </div>

          <div className="mx-auto grid w-full max-w-[1200px] grid-cols-3 gap-4">
            {howItWorks.map((s) => (
              <div key={s.step} className="rounded-[20px] bg-[#F9FAFB] p-8">
                <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#3182F6] text-base font-extrabold text-white">
                  {s.step}
                </span>
                <div className="mt-[18px] text-xl font-extrabold tracking-[-0.025em] text-[#191F28]">{s.title}</div>
                <p className="mt-2.5 text-base leading-[1.62] text-[#6B7684]">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto flex w-full max-w-[1200px] gap-4">
            <div className="flex flex-1 items-center gap-[22px] rounded-[18px] bg-[#EAF8F1] px-[26px] py-[22px]">
              <img
                src="/tree.png"
                alt=""
                width={108}
                height={108}
                className="flex-none rounded-2xl bg-white/60 p-3"
              />
              <div className="flex flex-col gap-1.5">
                {/*
                  히어로 금액과 같은 집계(#6)의 환산값입니다. 여기에 상수를 박아 두면
                  바로 위 편익 금액과 자릿수가 어긋납니다. 서버 값이 없으면 비웁니다.
                  ※ 화면에서 다시 축약하지 않습니다 — 홈 대시보드와 반올림이 갈립니다.
                */}
                <span className="text-[34px] font-extrabold tracking-[-0.03em] text-[#0F7A5A]">
                  {statsData ? `${formatNumber(statsData.equivalents.pineTrees)}그루` : '—'}
                </span>
                <span className="text-base font-semibold text-[#12A87A]">소나무를 심은 것과 같은 감축량</span>
              </div>
            </div>

            <div className="flex flex-1 items-center gap-[22px] rounded-[18px] bg-[#EAF2FE] px-[26px] py-[22px]">
              <img
                src="/truck.png"
                alt=""
                width={108}
                height={108}
                className="flex-none rounded-2xl bg-white/70 p-3"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[34px] font-extrabold tracking-[-0.03em] text-[#1B64DA]">
                  {statsData ? `${formatNumber(statsData.equivalents.trucksBlocked)}대` : '—'}
                </span>
                <span className="text-base font-semibold text-[#3182F6]">도심 진입을 막은 대형 트럭</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1200px]">
          <LandingSection id="how-agent">
            <SectionHeader badge={agentSection.badge} title={agentSection.title} lead={agentSection.lead} />

            <div className="grid grid-cols-[1fr_1.15fr] items-center gap-8 rounded-[20px] bg-[#F5F9FF] px-9 py-[34px]">
              <div className="flex flex-col gap-3">
                <span className="inline-flex self-start items-center gap-[7px] rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[#1B64DA]">
                  <AiChip />
                  {agentSection.cardBadge}
                </span>
                <h3 className="text-[22px] font-extrabold leading-[1.4] tracking-[-0.03em] text-[#191F28]">
                  {agentSection.cardTitle[0]}
                  <br />
                  {agentSection.cardTitle[1]}
                </h3>
                <p className="text-[15px] leading-[1.7] text-[#4E5968]">{agentSection.cardBody}</p>
                <p className="mt-1 text-sm leading-[1.65] text-[#8B95A1]">{agentSection.cardCaveat}</p>
              </div>

              <AgentFlowCard input={agentInput} output={agentOutput} />
            </div>
          </LandingSection>

          <LandingSection id="esg-report">
            <SectionHeader badge={esgSection.badge} title={esgSection.title} lead={esgSection.lead} />

            <div className="grid grid-cols-2 items-start gap-5">
              <PlanDocPreview stats={statsData} />
              <EsgDocPreview stats={statsData} />
            </div>

            <div className="flex items-center justify-center gap-7 rounded-2xl bg-[#F9FAFB] px-6 py-5">
              {esgSection.legend.map((l) => (
                <span key={l.label} className="flex items-center gap-2 text-[15px] text-[#4E5968]">
                  <span
                    className={`h-2.5 w-2.5 rounded-[3px] ${l.tone === 'blue' ? 'bg-[#D6E7FF]' : 'bg-[#E5E8EB]'}`}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </LandingSection>
        </div>

        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between rounded-[20px] bg-[#0B1220] px-9 py-[34px]">
          <div className="flex flex-col gap-2">
            <span className="text-2xl font-extrabold tracking-[-0.03em] text-white">{landingCta.title}</span>
            <span className="text-base text-[#B0B8C1]">{landingCta.body}</span>
          </div>
          <button
            type="button"
            onClick={onStart}
            className="h-14 rounded-[14px] bg-[#3182F6] px-[30px] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
          >
            {landingCta.button}
          </button>
        </div>
      </section>
    </div>
  );
}
