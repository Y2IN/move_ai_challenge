# 알뜰철도 X (RailHub X)

흩어진 소량 화물을 AI로 모아 코레일 빈 화차를 채우고, 철도 전환 편익을 ESG 자산으로 환전하는 B2B 물류 AI 에이전트.

- 기획·산식·구현 순서 → [docs/PROJECT.md](docs/PROJECT.md)
- 배포(Vercel)·환경변수·발표 체크리스트 → [docs/DEPLOY.md](docs/DEPLOY.md)

## 시작하기

```bash
npm install
cp .env.example .env.local   # GEMINI_API_KEY 입력
npm run dev                  # http://localhost:3000
```

Gemini API 키 발급: https://aistudio.google.com/apikey

## 스택

- **Next.js 15 (App Router) + React 19 + TypeScript** — 프론트와 백엔드를 한 레포에서 처리
- **백엔드는 별도 서버 없이 `app/api/*` Route Handlers** — 이번 MVP는 계산 + LLM 호출 위주라 Spring/FastAPI 계층이 오버헤드
- **Tailwind CSS v4**
- **Gemini API** (`@google/genai`) — `lib/gemini.ts`에 클라이언트 배선 완료

## 현재 상태

개발 환경 세팅만 완료. 기능 구현은 시작 전이며 진행 순서는 문서의 "구현 순서" 절을 따른다.
