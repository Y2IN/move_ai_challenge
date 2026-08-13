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
cp FE/.env.example FE/.env.local
npm run session-token              # 로그인된 Claude 계정 세션을 .env.local 에 주입 (없어도 실행됨)
npm run dev                        # http://localhost:3000
```

브라우저에서 http://localhost:3000 을 엽니다.
배선 확인: http://localhost:3000/api/health → `{"ok":true,...}`

### 3. 어떤 화면부터 보면 되나

`/` (랜딩) → **바로 시작하기** → `/demo` 에서 역할을 고릅니다. 회원가입·비밀번호 없이 들어갑니다.

| 역할 | 보게 되는 화면 | 추천 순서 |
| --- | --- | --- |
| **기업 물류 담당자** | 화물 등록 · 합적 매칭 · ESG 편익 · 보조금 신청서 | `/home` → `/freight/new` (화물 등록) → `/matching/confirmed` (매칭 결과) → `/benefit` (편익 환산) → `/subsidy/new` (ESG 리포트 생성) |
| **코레일 담당자** | 공차 현황 · 화차 배정 승인 · 노선별 수익 | `/home` → `/korail/wagons` (빈 화차) → `/korail/clients` (배정 승인) → `/korail/performance` (추가 수익) |

매칭이 깨지는 시나리오를 보려면 `/matching/unmatched` → `/matching/negotiation` 으로 들어가면 조건 조율 에이전트가 협상 메시지를 만드는 과정을 볼 수 있습니다.

## Claude 인증 — 둘 중 하나만 있으면 됩니다

| 방식 | 넣는 값 | 비고 |
| --- | --- | --- |
| **계정 세션** (권장) | `ANTHROPIC_AUTH_TOKEN` | `npm run session-token` 이 자동으로 채웁니다. 키 발급이 필요 없습니다. **몇 시간이면 만료**되므로 401 이 뜨면 다시 실행하세요 |
| 콘솔 API 키 | `ANTHROPIC_API_KEY` | https://platform.claude.com → Settings → API keys |

인증이 아예 없어도 서버는 뜹니다. LLM 문단은 사전 작성된 서술 초안으로 대체되고 응답에
`source: "fallback"` 배지가 붙습니다 — 시연이 인증 때문에 멈추지 않게 하려는 설계입니다.
초안은 문단마다 여러 벌 있어 재생성할 때마다 다른 벌이 나옵니다
(`BE/src/esg/paragraphs.ts` 의 `fallbacks`). 화면에는 인증 복구 명령 대신
"데모 모드" 안내가 뜹니다 — 세션 토큰이 만료됐다면 `npm run session-token` 을 다시 실행하세요.

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
- **Claude API** (`@anthropic-ai/sdk`) — `BE/src/claude.ts`. `import { getClaude } from "@railhub/be/claude"`
- 데이터베이스 없음. 데이터는 프로세스 메모리에 보관한다 (시연용 MVP)

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/PROJECT.md](docs/PROJECT.md) | 기획·산식·구현 순서 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 배포(Vercel)·환경변수·발표 체크리스트 |
| [docs/SOURCES.md](docs/SOURCES.md) | 편익 계산에 쓴 계수의 출처 |
| [docs/PITCH_POINTS.md](docs/PITCH_POINTS.md) | 발표 포인트 |
