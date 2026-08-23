# 알뜰철도 X (RailHub X)

흩어진 소량 화물을 AI로 모아 코레일 빈 화차를 채우고, 철도 전환 편익을 ESG 자산으로 환전하는 B2B 물류 AI 에이전트.

## 무엇을 하는 서비스인가

**문제** — 중소·중견기업은 혼자서 화물열차 한 편성을 채우지 못해 트럭을 쓰고, 그 사이 코레일 화차는 빈 채로 돌아온다. 게다가 2026년부터 ESG 공시(Scope 3)가 의무화되는데 "철도로 바꿔서 탄소를 얼마나 줄였는지"를 숫자로 낼 방법이 없다.

**해결** — 화물 데이터를 넣으면 4단계를 자동으로 돌린다.

| 단계 | 하는 일 |
| --- | --- |
| ① 합적 매칭 | 노선·시점이 비슷한 여러 회사 화물을 묶어 빈 화차에 배정 |
| ② 조건 조율 | 매칭이 깨졌을 때 "출발일 하루만 미루면 운임 31% 절감" 같은 설득 메시지를 화주별로 생성 (Claude) |
| ③ 편익 환산 | 도로 대비 탄소·대기오염·사고·혼잡 절감분을 원(KRW)으로 계산 |
| ④ ESG 리포트 | 계산 결과를 K-ESG 공시에 그대로 쓸 수 있는 문장으로 작성 (Claude) |

②가 핵심 차별점이다. 조건이 어긋난 화주 대부분은 못 바꾸는 게 아니라 바꿀 이유를 못 받아서 안 바꾼다.

자세한 기획·산식은 → [docs/PROJECT.md](docs/PROJECT.md)

## 화면 보러 가기

### 1. 배포된 사이트 (설치 없이 바로)

**https://railhub-x.vercel.app** — 로그인 없이 열립니다. 랜딩 화면에서 **"바로 시작하기"** 를 누르면 역할 선택으로 넘어갑니다.

### 2. 내 컴퓨터에서 실행

```bash
npm install                        # 루트에서 1회 (FE·BE 워크스페이스 동시 설치)
cp FE/.env.example FE/.env.local   # GEMINI_API_KEY 를 채운다 (아래 참고)
npm run dev                        # http://localhost:3000
```

배선 확인: http://localhost:3000/api/health → `llm.ready` / `db.reachable` 로 무엇이 붙었는지 알 수 있습니다.

### 3. 어떤 화면부터 보면 되나

`/` (랜딩) → **바로 시작하기** → `/demo` 에서 역할을 고릅니다. 회원가입·비밀번호 없이 들어갑니다.

| 역할 | 보게 되는 화면 | 추천 순서 |
| --- | --- | --- |
| **기업 물류 담당자** | 화물 등록 · 합적 매칭 · ESG 편익 · 보조금 신청서 | `/home` → `/freight/new` (화물 등록) → `/matching/confirmed` (매칭 결과) → `/benefit` (편익 환산) → `/subsidy/new` (ESG 리포트 생성) |
| **코레일 담당자** | 공차 현황 · 화차 배정 승인 · 노선별 수익 | `/home` → `/korail/wagons` (빈 화차) → `/korail/clients` (배정 승인) → `/korail/performance` (추가 수익) |

매칭이 깨지는 시나리오를 보려면 `/matching/unmatched` → `/matching/negotiation` 으로 들어가면 조건 조율 에이전트가 협상 메시지를 만드는 과정을 볼 수 있습니다.

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

> 스키마를 **다시** 적용해야 하는 시점입니다 — 이번 버전에서 컬럼이 늘었습니다
> (`shippers.contract` · `empty_wagons.demo_scenario` · `confirmations.client_key` ·
> `settlement_documents` 테이블). 안 해도 앱은 뜨지만 협약 물량·확정 멱등·서류
> 제출이 번들 값·인메모리로 떨어집니다. `db:push` 가 무엇을 건너뛰었는지 알려 줍니다.

**매칭·화면 데이터는 이제 DB 에서 읽습니다.** `/api/health` 의
`data.universe.source` · `data.ledger.source` 가 `db` 면 Supabase, `bundle` 이면
번들 JSON 폴백입니다. Table Editor 에서 화차를 늘리면 공차 화면이 따라 바뀝니다.

실적 원장을 다시 만들려면 (기준일이 오래돼 정산 격차가 벌어질 때):

```bash
npm run gen:ledger                 # 실행일 기준으로 원장 재생성 + seed.json 자동 동기화
npm run db:push
```

## 폴더 구조

```
├─ FE/   Next.js 15 (App Router)
│   ├─ app/         화면 라우트 + app/api/* Route Handlers (= 백엔드 엔드포인트)
│   └─ src/screens/ 화면 컴포넌트
└─ BE/   도메인 로직·타입 (매칭 엔진, 편익 산식, ESG 문단 생성). 빌드 산출물 없이 FE가 TS 소스를 직접 import
```

npm workspaces 하나로 묶여 있어 **배포도 Vercel 프로젝트 1개**다 (Root Directory = `FE`). BE는 별도 HTTP 서버가 아니므로 CORS·API base URL 설정이 없다.

## 스택

- **Next.js 15 (App Router) + React 19 + TypeScript** — 프론트와 백엔드를 한 레포에서 처리
- **백엔드는 별도 서버 없이 `FE/app/api/*` Route Handlers** — 이번 MVP는 계산 + LLM 호출 위주라 Spring/FastAPI 계층이 오버헤드
- **Tailwind CSS v4**
- **Google Gemini** (`@google/genai`) — `BE/src/llm.ts` 한 파일에 배선을 가둬 뒀다. 호출부는 `generateText({ system, prompt, maxTokens })` 만 쓰고 SDK 를 직접 import 하지 않는다 (공급자를 바꿔도 이 파일만 고치면 된다)
- **Supabase (PostgreSQL)** — `BE/src/db/`. 등록 화물·편성·조율·사업계획서 초안의 영속 저장소. **환경변수가 없으면 인메모리로 되돌아간다** — DB 가 죽어도 화면은 그대로 동작한다

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/PROJECT.md](docs/PROJECT.md) | 기획·산식·구현 순서 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 배포(Vercel)·환경변수·발표 체크리스트 |
| [docs/SOURCES.md](docs/SOURCES.md) | 편익 계산에 쓴 계수의 출처 |
| [docs/PITCH_POINTS.md](docs/PITCH_POINTS.md) | 발표 포인트 |
