# 배포 가이드

배포 대상: **Vercel** (Next.js 프론트 + `app/api/*` 서버리스 함수가 한 번에 올라감. 별도 서버·인프라 없음)

```
git push origin main
      │
      ├─▶ GitHub Actions (CI)  : typecheck + build 검증
      │
      └─▶ Vercel Git 연동      : 자동 배포
              ├─ main 브랜치     → 프로덕션 (고정 URL, 발표용)
              └─ 그 외 브랜치/PR → 프리뷰 URL (팀원 확인용)
```

CI와 Vercel 배포는 **병렬로 독립 실행**된다. CI가 깨져도 Vercel은 배포를 시도하므로, 발표 직전에는 CI 초록불을 꼭 확인할 것.

---

## 1. 최초 1회 세팅 (10분)

### 1-1. Vercel 프로젝트 연결

1. https://vercel.com 접속 → **GitHub 계정으로 로그인**
2. **Add New… → Project**
3. `Y2IN/move_ai_challenge` 저장소 **Import**
4. 설정 화면에서 확인만 하고 그대로 둔다
   - Framework Preset: `Next.js` (자동 감지)
   - Build Command / Output Directory: **건드리지 말 것** (자동)
   - Root Directory: `./`
5. **Environment Variables** 에 아래 2개 추가 (2번 절 참고)
6. **Deploy** 클릭

이후로는 `git push` 만 하면 자동 배포된다. 별도 명령 불필요.

### 1-2. 환경변수 등록 ⚠️ 필수

Vercel 대시보드 → **Settings → Environment Variables**

| Key | Value | 적용 환경 |
|---|---|---|
| `GEMINI_API_KEY` | AI Studio에서 발급한 키 | Production, Preview, Development 전부 체크 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 전부 체크 |

- 키 발급: https://aistudio.google.com/apikey
- **환경변수를 추가·수정한 뒤에는 재배포해야 반영된다.** (Deployments → 최신 항목 → ⋯ → Redeploy)
- 로컬은 `.env.local` 을 쓴다. 이 파일은 `.gitignore` 처리되어 있으니 **절대 커밋하지 말 것.**

### 1-3. 발표용 URL 확보

기본 도메인은 `move-ai-challenge.vercel.app` 형태로 자동 생성된다.
프로젝트명이 길어 발표에 부담되면 Settings → Domains 에서 짧은 이름으로 변경 (예: `railhub-x.vercel.app`).

---

## 2. 일상 개발 흐름

```bash
git checkout -b feat/matching-engine
# 작업
npm run typecheck && npm run build   # 로컬에서 미리 확인 (권장)
git push -u origin feat/matching-engine
```

→ PR을 열면 Vercel 봇이 **프리뷰 URL**을 코멘트로 달아준다. 팀원은 로컬 세팅 없이 그 링크로 확인.
→ main에 머지되면 자동으로 프로덕션 반영.

---

## 3. 설정 파일

### `vercel.json`
- `regions: ["icn1"]` — 서울 리전. 심사장에서 접속하므로 지연시간을 줄인다.
- `functions."app/api/**/*.ts".maxDuration: 60` — **중요.** Gemini 리포트 생성은 10초를 넘길 수 있는데 기본 제한이 짧아 타임아웃이 난다.

### `.github/workflows/ci.yml`
- push(main) / PR 마다 `typecheck` + `build` 실행
- 빌드에 더미 `GEMINI_API_KEY` 를 주입한다. **Gemini 클라이언트를 모듈 최상단에서 초기화하면 빌드가 깨지므로**, 반드시 요청 처리 함수 "안에서" `getGemini()` 를 호출할 것 (`lib/gemini.ts` 가 그렇게 되어 있음)

---

## 4. 발표 당일 체크리스트

- [ ] 프로덕션 URL이 열리는가 (**휴대폰 데이터로도** 한 번 확인 — 현장 와이파이가 막혀 있는 경우가 있다)
- [ ] Vercel 환경변수에 `GEMINI_API_KEY` 가 실제로 들어가 있는가 (로컬만 되고 배포는 안 되는 사고가 가장 흔하다)
- [ ] 최신 커밋이 프로덕션에 반영됐는가 (Deployments 목록 최상단 = `main` 최신 해시)
- [ ] Gemini API 일일 할당량이 남아 있는가
- [ ] **발표 30분 전부터는 main에 push 금지** (배포 중 상태로 시연하는 사고 방지)
- [ ] 최후의 보루: `npm run dev` 로컬 구동본을 띄워두고 백업 시연 준비

## 5. 문제 발생 시

| 증상 | 조치 |
|---|---|
| 배포는 됐는데 AI 기능만 실패 | 환경변수 누락. 등록 후 **Redeploy** 필수 |
| 함수 타임아웃 (504) | `vercel.json` 의 `maxDuration` 확인. Hobby 플랜 상한 초과 시 프롬프트를 줄일 것 |
| 방금 배포로 화면이 깨짐 | Deployments → 직전 정상 배포 → ⋯ → **Promote to Production** (즉시 롤백. 발표 중이면 이게 가장 빠르다) |
| 빌드 실패 | Actions 로그를 먼저 볼 것. 로컬 `npm run build` 로 재현되는지 확인 |
