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
| `CLAUDE_MODEL` | ✅ `claude-opus-5` | 코드 기본값과 동일. 모델을 바꿀 때만 손댄다 |
| `ANTHROPIC_API_KEY` | ⬜ **미등록** | 없으면 AI 서술이 전부 사전 작성 문장으로 나온다 (화면은 정상) |

- 키 발급: https://platform.claude.com → Settings → API keys
- **배포에 계정 세션 토큰(`ANTHROPIC_AUTH_TOKEN`)을 쓰지 말 것.** 몇 시간이면 만료되어 발표 당일 죽는다. 배포는 만료 없는 콘솔 API 키를 쓴다
- **환경변수를 추가·수정한 뒤에는 재배포해야 반영된다** (Deployments → 최신 항목 → ⋯ → Redeploy)
- 로컬은 `FE/.env.local` 을 쓴다. `npm run session-token` 으로 계정 세션을 넣으면 키 발급 없이 개발할 수 있다. 이 파일은 `.gitignore` 처리되어 있으니 **절대 커밋하지 말 것**

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
- `functions."app/api/**/*.ts".maxDuration: 60` — **중요.** Claude 호출(조율안 탐색·리포트 생성)은 10초를 넘길 수 있는데 기본 제한이 짧아 타임아웃이 난다. 특히 `/api/negotiate` 는 화주 수만큼 메시지를 생성하므로 가장 오래 걸린다.

### `.github/workflows/ci.yml`
- push(main) / PR 마다 `typecheck` + `build` 실행. 루트 스크립트가 워크스페이스로 위임하므로(`typecheck --workspaces`, `build -w FE`) CI 파일은 폴더 분리 후에도 그대로다
- 빌드에 더미 `ANTHROPIC_API_KEY` 를 주입한다. **Claude 클라이언트를 모듈 최상단에서 초기화하면 빌드가 깨지므로**, 반드시 요청 처리 함수 "안에서" `getClaude()` 를 호출할 것 (`BE/src/claude.ts` 가 그렇게 되어 있음)

---

## 4. 발표 당일 체크리스트

- [ ] https://railhub-x.vercel.app 가 열리는가 (**휴대폰 데이터로도** 한 번 확인 — 현장 와이파이가 막혀 있는 경우가 있다. 로그인 벽이 뜨면 SSO 보호가 다시 켜진 것)
- [ ] Vercel 환경변수에 `ANTHROPIC_API_KEY` 가 실제로 들어가 있는가 (로컬만 되고 배포는 안 되는 사고가 가장 흔하다)
- [ ] 최신 커밋이 프로덕션에 반영됐는가 (Deployments 목록 최상단 = `main` 최신 해시)
- [ ] Claude API 일일 할당량이 남아 있는가
- [ ] **발표 30분 전부터는 main에 push 금지** (배포 중 상태로 시연하는 사고 방지)
- [ ] 최후의 보루: `npm run dev` 로컬 구동본을 띄워두고 백업 시연 준비

## 5. 문제 발생 시

| 증상 | 조치 |
|---|---|
| 배포는 됐는데 AI 기능만 실패 | 환경변수 누락. 등록 후 **Redeploy** 필수 |
| 함수 타임아웃 (504) | `vercel.json` 의 `maxDuration` 확인. Hobby 플랜 상한 초과 시 프롬프트를 줄일 것 |
| 방금 배포로 화면이 깨짐 | Deployments → 직전 정상 배포 → ⋯ → **Promote to Production** (즉시 롤백. 발표 중이면 이게 가장 빠르다) |
| 빌드 실패 | Actions 로그를 먼저 볼 것. 로컬 `npm run build` 로 재현되는지 확인 |
