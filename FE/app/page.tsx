export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-8 py-20">
      <p className="text-sm tracking-widest text-emerald-400">RAILHUB · 알뜰철도 X</p>

      <h1 className="text-4xl font-bold leading-snug">
        흩어진 화물을 모아 빈 화차를 채우고,
        <br />
        친환경 편익을 <span className="text-emerald-400">ESG 자산</span>으로 환전합니다
      </h1>

      <p className="leading-relaxed text-slate-400">
        코레일 공차율 개선과 기업 Scope 3 공시 대응을 동시에 해결하는 B2B 물류 AI 에이전트.
        현재 개발 환경 세팅만 완료된 상태이며, 기능 구현은 아직 시작하지 않았습니다.
      </p>

      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
        <p className="mb-3 font-semibold text-slate-100">다음 작업</p>
        <ul className="space-y-1.5 text-slate-400">
          <li>· 기획 문서 확인 — docs/PROJECT.md</li>
          <li>· FE/.env.local 생성 후 ANTHROPIC_API_KEY 입력</li>
          <li>· 배선 확인 — /api/health</li>
          <li>· 화물 입력 / 공차 매칭 / 편익 대시보드 / ESG 리포트 화면 구현</li>
        </ul>
      </div>
    </main>
  );
}
