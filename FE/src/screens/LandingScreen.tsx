import {
  brand,
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
  onContact?: () => void;
}

/** 01 — 로그인 전 서비스 소개 랜딩 */
export function LandingScreen({ onLogin, onStart, onContact }: LandingScreenProps) {
  return (
    <div className="min-h-screen bg-white font-['Pretendard',system-ui,sans-serif] antialiased">
      <section className="bg-[#0B1220] pb-[88px]">
        <nav className="flex h-[72px] items-center justify-between px-10">
          <div className="flex items-center gap-9">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[#3182F6] text-sm font-extrabold text-white">
                X
              </span>
              <span className="text-[17px] font-extrabold tracking-[-0.03em] text-white">{brand.name}</span>
            </div>
            <div className="flex gap-6 text-[15px] font-semibold text-[#8B95A1]">
              {marketingNav.map((n) => (
                <span key={n}>{n}</span>
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

          <div className="relative mt-0.5 flex flex-col items-center">
            <span
              className="pointer-events-none absolute -top-[34px] left-1/2 h-[240px] w-[780px] -translate-x-1/2 rounded-full"
              style={{
                background:
                  'radial-gradient(closest-side, rgba(49,130,246,0.34), rgba(49,130,246,0))',
              }}
            />
            <div className="relative text-[116px] font-extrabold leading-[1.04] tracking-[-0.055em] text-white">
              {heroAmount.value}
              <span className="ml-3 text-[58px] font-bold tracking-[-0.03em] text-[#8FC2FF]">
                {heroAmount.unit}
              </span>
            </div>
            <div className="relative mt-3.5 flex items-center gap-2.5">
              <span className="text-base font-semibold tabular-nums text-[#8B95A1]">{heroAmount.krw}</span>
              <span className="rounded-full bg-[#15C47E]/[0.16] px-3 py-1.5 text-sm font-bold text-[#34D399]">
                {heroAmount.delta}
              </span>
            </div>
          </div>

          <div className="mt-[22px] flex flex-wrap justify-center gap-2">
            {heroChips.map((c) => (
              <span key={c.label} className="rounded-full bg-white/[0.07] px-[18px] py-[11px] text-[15px] text-[#D1D6DB]">
                {c.label} <b className="ml-1.5 text-white">{c.value}</b>
              </span>
            ))}
          </div>

          <div className="mt-[30px] flex gap-2.5">
            <button
              type="button"
              onClick={onStart}
              className="h-14 rounded-[14px] bg-[#3182F6] px-[30px] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              무료로 시작하기
            </button>
            <button
              type="button"
              onClick={onContact}
              className="h-14 rounded-[14px] bg-white/10 px-[30px] text-[17px] font-bold text-white transition-colors hover:bg-white/[0.18]"
            >
              도입 문의
            </button>
          </div>

          <div className="mt-[18px] text-[15px] text-[#6B7684]">{heroFootnote}</div>
        </div>
      </section>

      <section className="flex flex-col gap-9 px-10 py-20">
        <header className="text-center">
          <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#191F28]">
            화물을 올리면, 나머지는 AI가 합니다
          </h2>
          <p className="mt-2.5 text-[17px] text-[#6B7684]">엑셀 한 장, 또는 한 문장이면 됩니다</p>
        </header>

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
            <div className="h-[108px] w-[108px] flex-none rounded-2xl bg-white/60" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <span className="text-[34px] font-extrabold tracking-[-0.03em] text-[#0F7A5A]">4만 그루</span>
              <span className="text-base font-semibold text-[#12A87A]">소나무를 심은 것과 같은 감축량</span>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-[22px] rounded-[18px] bg-[#F2F4F6] px-[26px] py-[22px]">
            <div className="h-[108px] w-[108px] flex-none rounded-2xl bg-white/70" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <span className="text-[34px] font-extrabold tracking-[-0.03em] text-[#191F28]">45대</span>
              <span className="text-base font-semibold text-[#6B7684]">도심 진입을 막은 대형 트럭</span>
            </div>
          </div>
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
