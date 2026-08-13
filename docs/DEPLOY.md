# 배포 가이드

배포 대상: **Vercel** (Next.js 프론트 + `FE/app/api/*` 서버리스 함수가 한 번에 올라감. 별도 서버·인프라 없음)

레포는 `FE`(Next.js) / `BE`(도메인 로직) 두 npm workspace로 나뉘어 있지만, **배포는 Vercel 프로젝트 1개**다. BE는 독립 서버가 아니라 FE가 소스째 import 하는 패키지이므로 배포 대상이 아니다.

```
git push
      │
      └─▶ GitHub Actions
              ├─ build   : typecheck + build 검증
              └─ deploy  : build 초록불일 때만 실행 (needs: build)
                      ├─ main 브랜치     → 프로덕션 (발표용 고정 URL)
                      └─ 그 외 브랜치/PR → 프리뷰 URL (PR 코멘트로 자동 게시)
```

배포는 **CI를 통과한 커밋만** 나간다. Vercel Git 연동에 맡기면 CI가 빨간불이어도 Vercel이 독립적으로 배포하므로, 배포 단계를 CI 워크플로 안에 `needs: build` 로 묶어 두었다.

---

## 1. 세팅 현황

### 1-1. Vercel 프로젝트 — ✅ 완료

| 항목 | 값 |
|---|---|
| 프로젝트 | `railhub-x` (팀 `y2ins-projects`) |
| **프로덕션 URL** | **https://railhub-x.vercel.app** |
| Root Directory | `FE` — 루트에는 Next 앱이 없어서 반드시 필요하다 |
| Framework | `nextjs` |
| 접근 보호 | **해제됨.** 팀 프로젝트는 SSO 보호가 기본이라 심사위원이 열면 로그인 벽에 막힌다 |
| 리전 | `icn1` (서울) — `FE/vercel.json` |

재연결이 필요하면 루트에서 `vercel link --yes --project railhub-x`.

### 1-2. 환경변수

**Vercel** (대시보드 → Settings → Environment Variables)

| Key | 상태 | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ 등록됨 | **Tier 1(선불) 결제가 붙은 `Default Gemini Project` 발급분.** 없으면 AI 서술이 전부 사전 작성 문장으로 나온다 (화면은 정상, "데모 모드" 배너가 뜬다) |
| `GEMINI_MODEL` | ✅ `gemini-3.6-flash` | 코드 기본값(`gemini-3.1-flash-lite`)을 덮어쓴다. 아래 "모델 고를 때" 참고 |
| `SUPABASE_URL` | ✅ 등록됨 | 없으면 등록 화물·초안이 인메모리로만 남는다 (콜드 스타트마다 소실) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ 등록됨 | ⚠️ **`NEXT_PUBLIC_` 접두어 금지.** 붙는 순간 브라우저 번들에 박혀 DB 전체가 공개된다 |

**모델 고를 때** — 실제로 밟은 지뢰 두 개다.

| 모델 | 주의 |
|---|---|
| `gemini-3.6-flash` | 무료 티어 일일 한도가 **모델당 20회**라 제일 먼저 마른다. 마르면 429 로 전 문단이 폴백이 된다. **유료 키에서는 문제 없다** — 현재 프로덕션이 이 모델을 쓴다 |
| `gemini-2.5-flash` | 신규 사용자에게 404 (제공 중단). 그런데 **모델 목록 API 에는 여전히 보인다** — 목록만 보고 고르면 걸린다 |
| `gemini-3.1-flash-lite` | 할당량이 따로·넉넉하다. 무료 키로 개발할 때 쓴다 (코드 기본값) |

- **결제 등급은 API 키가 속한 Google Cloud 프로젝트에 붙는다.** 결제를 켠 프로젝트와 키를 발급한 프로젝트가 다르면 계속 무료 티어로 집계된다. 429 응답의 `quotaId` 에 `FreeTier` 가 찍혀 있으면 이 경우다 — https://aistudio.google.com/apikey 에서 키 옆 프로젝트 이름을 확인할 것
- **환경변수를 추가·수정한 뒤에는 재배포해야 반영된다** (Deployments → 최신 항목 → ⋯ → Redeploy)
- 로컬은 `FE/.env.local` 을 쓴다. 이 파일은 `.gitignore` 처리되어 있으니 **절대 커밋하지 말 것**

#### Gemini API 키 발급 (2분, 카드 불필요)

1. https://aistudio.google.com/apikey → Google 계정 로그인
2. **Create API key** → 프로젝트 선택 (없으면 자동 생성)
3. 키 복사
4. ⚠️ **`Set up Billing` 은 누르지 말 것.** 누르는 순간 유료 티어로 올라가고 지출 상한이 사라진다
5. Vercel → Settings → Environment Variables → `GEMINI_API_KEY` 추가 (Production + Preview 둘 다 체크)
6. **Redeploy** — 환경변수는 재배포해야 반영된다

> **왜 무료 티어인가.** Google 은 Anthropic 의 선불 크레딧 같은 하드 캡이 없다. Cloud Billing 의
> 예산(budget)은 **알림일 뿐 자동 차단이 아니라서**, 진짜로 끊으려면 Pub/Sub + Cloud Function 으로
> 결제 계정을 해제하는 배선을 직접 짜야 한다. 결제 수단을 아예 등록하지 않는 쪽이 확실하고 간단하다.
>
> 대가는 **분당·일일 요청 제한**이다. 한도에 걸리면 그 호출만 폴백 문장으로 떨어지고
> (화면에는 "데모 모드" 배너), 잠시 뒤 재생성하면 다시 AI 문장이 나온다. 앱이 죽지는 않는다.

#### Supabase 키 발급

1. https://supabase.com → **New project** (리전은 `Northeast Asia (Seoul)`)
2. **SQL Editor** 에 `BE/src/db/schema.sql` 을 통째로 붙여넣고 **Run** (몇 번을 다시 돌려도 안전하다)
3. **Project Settings → API** 에서 두 값을 복사
   - `Project URL` → `SUPABASE_URL`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY` — `anon` 키가 아니다
4. `FE/.env.local` 에 넣고 루트에서 `npm run db:push` — seed.json + ledger.json 이 통째로 들어간다
5. 같은 두 값을 Vercel 환경변수에도 등록 → **Redeploy**

> 데이터를 고칠 땐 `seed.json` / `ledger.json` 만 수정하고 `npm run db:push` 를 다시 돌린다.
> 대시보드에서 손으로 칠 일은 없다.

**GitHub Actions** (저장소 → Settings → Secrets and variables → Actions)

| Secret | 상태 |
|---|---|
| `VERCEL_ORG_ID` | ✅ 등록됨 |
| `VERCEL_PROJECT_ID` | ✅ 등록됨 |
| `VERCEL_TOKEN` | ⬜ **미등록** — 아래 참조 |

`VERCEL_TOKEN` 은 CLI 세션으로 발급할 수 없어 사람이 만들어야 한다.

1. https://vercel.com/account/tokens → **Create Token** (Scope: `y2ins-projects`)
2. 터미널에서 `gh secret set VERCEL_TOKEN` 실행 후 붙여넣기
   (채팅·이슈·커밋에 토큰을 붙여넣지 말 것. 위 명령은 값을 표준입력으로만 받는다)

세 개가 다 차기 전까지 deploy 잡은 **경고만 남기고 건너뛴다.** CI가 빨간불이 되지는 않는다.

### 1-3. Vercel Git 연동 정리 ⚠️

`vercel link` 가 GitHub 저장소를 자동 연결해 두었다. `VERCEL_TOKEN` 을 등록해 Actions 배포가 돌기 시작하면 **같은 커밋이 두 번 배포되므로**, 그 시점에 연동을 끊는다.

```sh
vercel git disconnect
```

끊기 전까지는 Vercel 연동이 배포를 맡으므로 배포가 비는 구간은 없다.

---

## 2. 일상 개발 흐름

```bash
git checkout -b feat/matching-engine
# 작업
npm run typecheck && npm run build   # 로컬에서 미리 확인 (권장)
git push -u origin feat/matching-engine
```

→ PR을 열면 CI가 통과한 뒤 **프리뷰 URL**이 PR 코멘트로 달린다 (커밋마다 같은 코멘트를 갱신). 팀원은 로컬 세팅 없이 그 링크로 확인.
→ main에 머지되면 CI 통과 후 자동으로 프로덕션 반영.

수동 배포가 필요하면 (예: CI를 못 기다리는 발표 직전) 루트에서:

```sh
vercel deploy --prod --yes    # 현재 작업 디렉터리를 그대로 올린다 — 커밋 안 된 변경도 포함된다
```

---

## 3. 설정 파일

### `FE/vercel.json`
Root Directory 가 `FE` 이므로 이 파일도 FE 안에 있어야 인식된다. 경로 패턴도 FE 기준이다.

- `regions: ["icn1"]` — 서울 리전. 심사장에서 접속하므로 지연시간을 줄인다.
- `functions."app/api/**/*.ts".maxDuration: 60` — **중요.** 생성 AI 호출(조율안 탐색·리포트 생성)은 10초를 넘길 수 있는데 기본 제한이 짧아 타임아웃이 난다. 특히 `/api/negotiate` 는 화주 수만큼 메시지를 생성하므로 가장 오래 걸린다.

### `.github/workflows/ci.yml`
- push(main) / PR 마다 `typecheck` + `build` 실행. 루트 스크립트가 워크스페이스로 위임하므로(`typecheck --workspaces`, `build -w FE`) CI 파일은 폴더 분리 후에도 그대로다
- 빌드에 더미 `GEMINI_API_KEY` 를 주입한다. **클라이언트를 모듈 최상단에서 초기화하면 빌드가 깨지므로**, 반드시 요청 처리 함수 "안에서" `generateText()` 를 호출할 것 (`BE/src/llm.ts` 가 지연 초기화로 되어 있음)

---

## 4. 발표 당일 체크리스트

- [ ] https://railhub-x.vercel.app 가 열리는가 (**휴대폰 데이터로도** 한 번 확인 — 현장 와이파이가 막혀 있는 경우가 있다. 로그인 벽이 뜨면 SSO 보호가 다시 켜진 것)
- [ ] Vercel 환경변수에 `GEMINI_API_KEY` 가 실제로 들어가 있는가 (로컬만 되고 배포는 안 되는 사고가 가장 흔하다) — `/api/health` 의 `llm.ready` 로 확인
- [ ] 최신 커밋이 프로덕션에 반영됐는가 (Deployments 목록 최상단 = `main` 최신 해시)
- [ ] **`/api/health` 가 `"reachable": true` 를 주는가** — `false` 면 Supabase 가 잠들었거나 키가 빠진 것이다. 앱은 뜨지만 등록한 화물이 안 쌓인다
- [ ] 직전에 AI 서술을 한 번 생성해 봤는가 (무료 티어 일일 한도에 걸려 있으면 "데모 모드" 배너가 뜬다)
- [ ] **발표 30분 전부터는 main에 push 금지** (배포 중 상태로 시연하는 사고 방지)
- [ ] 최후의 보루: `npm run dev` 로컬 구동본을 띄워두고 백업 시연 준비

## 5. 문제 발생 시

| 증상 | 조치 |
|---|---|
| 배포는 됐는데 AI 기능만 실패 | 환경변수 누락. 등록 후 **Redeploy** 필수 |
| 함수 타임아웃 (504) | `vercel.json` 의 `maxDuration` 확인. Hobby 플랜 상한 초과 시 프롬프트를 줄일 것 |
| 방금 배포로 화면이 깨짐 | Deployments → 직전 정상 배포 → ⋯ → **Promote to Production** (즉시 롤백. 발표 중이면 이게 가장 빠르다) |
| 빌드 실패 | Actions 로그를 먼저 볼 것. 로컬 `npm run build` 로 재현되는지 확인 |
