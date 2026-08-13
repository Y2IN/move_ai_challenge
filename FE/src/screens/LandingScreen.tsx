import { useEffect, useRef, useState } from 'react';
import { AgentFlowCard, EsgDocPreview, PlanDocPreview } from '../components/DocPreview';
import { AiChip, LandingSection, SectionHeader } from '../components/LandingSection';
import {
  agentInput,
  agentOutput,
  agentSection,
  brand,
  esgSection,
  howSection,
  heroAmount,
  heroChips,
  heroFootnote,
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

/** 01 — 로그인 전 서비스 소개 랜딩 */
export function LandingScreen({ onLogin, onStart }: LandingScreenProps) {
  const { active, onJump } = useActiveSection();

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

          <div className="mt-[34px] text-base font-semibold text-[#8B95A1]">{heroAmount.caption}</div>

          <div className="mt-0.5 flex flex-col items-center">
            {/* 숫자는 흰→블루 그라디언트를 글자에 클립, '원'만 단색 블루로 남김 */}
            <div className="bg-[linear-gradient(180deg,#FFFFFF_38%,#8FC2FF_100%)] bg-clip-text text-[116px] font-extrabold leading-[1.04] tracking-[-0.055em] text-transparent">
              {heroAmount.value}
              <span className="ml-3 text-[58px] font-bold tracking-[-0.03em] text-[#8FC2FF]">
                {heroAmount.unit}
              </span>
            </div>
            <div className="h-[3px] w-[640px] rounded-full bg-[linear-gradient(90deg,transparent,#3182F6,transparent)]" />
            <div className="mt-3.5 flex items-center gap-2.5">
              <span className="text-base font-semibold tabular-nums text-[#8B95A1]">{heroAmount.krw}</span>
              <span className="rounded-full bg-[#15C47E]/[0.16] px-3 py-1.5 text-sm font-bold text-[#34D399]">
                {heroAmount.delta}
              </span>
            </div>
          </div>

          {/* ponytail: 벨트 폭을 중앙 720px로 고정 — 목록 1벌(약 800px)이 이보다 넓어야 빈칸이 안 생김 */}
          <div className="mx-auto mt-[22px] max-w-[720px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
            {/* ponytail: 컨테이너 gap 대신 칩마다 mr-2 — 그래야 -50%가 이음매에 정확히 맞음 */}
            <div className="chip-marquee flex w-max">
              {[...heroChips, ...heroChips].map((c, i) => (
                <span
                  key={`${c.label}-${i}`}
                  className="mr-2 shrink-0 rounded-full bg-white/[0.07] px-[18px] py-[11px] text-[15px] text-[#D1D6DB]"
                >
                  {c.label} <b className="ml-1.5 text-white">{c.value}</b>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-[30px] flex gap-2.5">
            <button
              type="button"
              onClick={onStart}
              className="h-14 rounded-[14px] bg-[#3182F6] px-[30px] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              {landingCta.button}
            </button>
          </div>

          <div className="mt-[18px] text-[15px] text-[#6B7684]">{heroFootnote}</div>
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
                <span className="text-[34px] font-extrabold tracking-[-0.03em] text-[#0F7A5A]">4만 그루</span>
                <span className="text-base font-semibold text-[#12A87A]">소나무를 심은 것과 같은 감축량</span>
              </div>
            </div>

            <div className="flex flex-1 items-center gap-[22px] rounded-[18px] bg-[#F2F4F6] px-[26px] py-[22px]">
              <img
                src="/truck.png"
                alt=""
                width={108}
                height={108}
                className="flex-none rounded-2xl bg-white/70 p-3"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[34px] font-extrabold tracking-[-0.03em] text-[#191F28]">45대</span>
                <span className="text-base font-semibold text-[#6B7684]">도심 진입을 막은 대형 트럭</span>
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
              <PlanDocPreview />
              <EsgDocPreview />
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
