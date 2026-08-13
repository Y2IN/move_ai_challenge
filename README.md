# 알뜰철도 X (RailHub X)

흩어진 소량 화물을 AI로 모아 코레일 빈 화차를 채우고, 철도 전환 편익을 ESG 자산으로 환전하는 B2B 물류 AI 에이전트.

- 기획·산식·구현 순서 → [docs/PROJECT.md](docs/PROJECT.md)
- 배포(Vercel)·환경변수·발표 체크리스트 → [docs/DEPLOY.md](docs/DEPLOY.md)

## 시작하기

```bash
npm install                        # 루트에서 1회 (FE·BE 워크스페이스 동시 설치)
cp FE/.env.example FE/.env.local   # GEMINI_API_KEY 를 채운다 (아래 참고)
npm run dev                        # http://localhost:3000
```

배선 확인: http://localhost:3000/api/health → `llm.ready` / `db.reachable` 로 무엇이 붙었는지 알 수 있습니다.

### 환경변수 — 둘 다 선택입니다 (없어도 서버는 뜹니다)

| 키 | 없으면 | 발급 |
| --- | --- | --- |
| `GEMINI_API_KEY` | AI 서술이 전부 사전 작성 초안으로 나옵니다 ("데모 모드" 배너) | https://aistudio.google.com/apikey → Create API key |
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | 등록 화물·초안이 프로세스 메모리에만 남습니다 (서버 재시작 시 소실) | https://supabase.com → Project Settings → API |

> ⚠️ Gemini 는 **결제 수단을 등록하지 않으면 무료 티어에 고정**됩니다 — 그게 곧 지출 상한입니다.
> AI Studio 에서 **Set up Billing 을 누르지 마세요.** 대신 분당·일일 요청 제한이 있고,
> 걸리면 아래 폴백으로 떨어집니다.

인증이 아예 없어도 서버는 뜹니다. LLM 문단은 사전 작성된 서술 초안으로 대체되고 응답에
`source: "fallback"` 배지가 붙습니다 — 시연이 인증 때문에 멈추지 않게 하려는 설계입니다.
초안은 문단마다 여러 벌 있어 재생성할 때마다 다른 벌이 나옵니다
(`BE/src/esg/paragraphs.ts` 의 `fallbacks`). 화면에는 "데모 모드" 안내가 뜹니다.

Supabase 를 붙였다면 스키마 적용 후 시드를 한 번 밀어 넣습니다:

```bash
# Supabase 대시보드 → SQL Editor 에 BE/src/db/schema.sql 붙여넣고 Run
npm run db:push                    # seed.json + ledger.json 을 통째로 투입
```

## 폴더 구조

```
├─ FE/   Next.js 15 (App Router). 화면 + app/api/* Route Handlers
└─ BE/   도메인 로직·타입. 빌드 산출물 없이 FE가 TS 소스를 직접 import
```

npm workspaces 하나로 묶여 있어 **배포도 Vercel 프로젝트 1개**다 (Root Directory = `FE`). BE는 별도 HTTP 서버가 아니므로 CORS·API base URL 설정이 없다.

## 스택

- **Next.js 15 (App Router) + React 19 + TypeScript** — 프론트와 백엔드를 한 레포에서 처리
- **백엔드는 별도 서버 없이 `FE/app/api/*` Route Handlers** — 이번 MVP는 계산 + LLM 호출 위주라 Spring/FastAPI 계층이 오버헤드
- **Tailwind CSS v4**
- **Google Gemini** (`@google/genai`) — `BE/src/llm.ts` 한 파일에 배선을 가둬 뒀다. 호출부는 `generateText({ system, prompt, maxTokens })` 만 쓰고 SDK 를 직접 import 하지 않는다 (공급자를 바꿔도 이 파일만 고치면 된다)
- **Supabase (PostgreSQL)** — `BE/src/db/`. 등록 화물·편성·조율·사업계획서 초안의 영속 저장소. **환경변수가 없으면 인메모리로 되돌아간다** — DB 가 죽어도 화면은 그대로 동작한다

## 현재 상태

개발 환경 세팅만 완료. 기능 구현은 시작 전이며 진행 순서는 문서의 "구현 순서" 절을 따른다.
