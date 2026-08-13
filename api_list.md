# 알뜰철도 X — 개발 필요 API 목록

화면 분석 기준: STEP 01~06, 총 13개 화면
작성일: 2026-08-13

---

## 0. 전제 · 스택 판단

요구사항이 **CRUD가 거의 없고 계산 + LLM 호출 위주**이며, 서버 2개 운영에 따른 CORS·이중 배포를 피하고 싶다는 점에서 **단일 서버(Next.js Route Handlers)** 구성이 맞습니다. 아래 목록은 프레임워크 중립적으로 적었고, 경로는 그대로 `app/api/**/route.ts`에 1:1 매핑됩니다.

다만 두 가지는 미리 정해두는 게 좋습니다.

| 항목 | 판단 | 이유 |
|---|---|---|
| 스트리밍 | SSE 2곳 필수 (`negotiation/stream`, `subsidy/stream`) | 06b 진행률 82%·4/5단계, 04d 적재율 41→75→94% 애니메이션이 화면 설계에 이미 박혀 있음. 폴링으로 대체하면 UX가 무너짐 |
| 장기 실행 | 신청서 생성 "약 10초" | Vercel serverless면 maxDuration 설정 필요. 문단 6개를 순차 LLM 호출하면 10초 초과 위험 → 문단별 병렬 호출 권장 |

**API 총 43개** — LLM 호출 8개, 순수 계산 5개, SSE 2개, 나머지는 조회/CRUD.

---

## 구현 현황 (2026-08-13 · `feat/cargo-matching`)

화물 등록·매칭 두 영역을 우선 구현. **LLM 없이도 시연 동선(등록 → 매칭 실패 → 조율 수락 → 편성 확정)이 API로 완결**됩니다. 세부 상태는 아래 §4·§5 표의 **상태** 열 참고.

- **✅ 완료 (7):** #11 등록 · #13 목록 · #14 수정 · #15 삭제 · #16 매칭요청 · #18 공차현황 · #19 편성확정
- **❌ 미구현 (2):** #10 자연어 파싱(LLM) · #12 엑셀 bulk(규칙기반, 시연 동선 밖)
- **🟡 부분 (1):** #20 reconcilable — 조율 후보(`negotiationCandidates`)만 반환, `conflict`/`lever` 미보강 (조율 에이전트와 세트)
- **⛔ 보류 (1):** #17 job — 현재 매칭이 sync라 불필요

> 그 외 섹션(인증·대시보드·조율·편익·보조금·ESG·코레일)은 착수 전. 다음 우선순위는 조율 에이전트(#21·#22, LLM 핵심).

---

## 1. 인증 · 계정 (5개)

역할이 `corp`(기업 물류 담당자) / `korail`(코레일 담당자) 2종으로 분기하고, 같은 대시보드에서 **응답 스키마는 같고 값만 다른** 구조입니다. 역할별 엔드포인트를 나누지 말고 하나로 두는 게 낫습니다.

| # | Method | Path | 용도 | 비고 |
|---|---|---|---|---|
| 1 | POST | `/api/auth/signup` | 회원가입 | `role`, `email`, `password`, `orgName`, `termsAgreed`. role이 korail이면 orgName은 "소속 본부·지사" |
| 2 | POST | `/api/auth/login` | 로그인 | → `{ accessToken, user, role, org }` |
| 3 | POST | `/api/auth/demo` | 데모 계정 입장 | **해커톤 시연 필수.** role만 받아 즉시 세션 발급. 02b 화면 "역할만 고르면 바로 입장" |
| 4 | GET | `/api/me` | 세션 확인 | 사이드바 "대성물산 · 김철도" 렌더 |
| 5 | POST | `/api/auth/logout` | 로그아웃 | |

---

## 2. 랜딩 (로그인 전) (1개)

| # | Method | Path | 용도 | 비고 |
|---|---|---|---|---|
| 6 | GET | `/api/public/stats` | 랜딩 히어로 수치 | 인증 불필요. 캐시 60초 |

```jsonc
// 6. GET /api/public/stats
{
  "quarterSubsidy": { "amount": 342000000, "label": "3억 4,200만", "deltaPct": 38 },
  "breakdown": [
    { "key": "ghg",        "label": "온실가스 감축", "value": "1억 5,800만" },
    { "key": "airQuality", "label": "대기오염 저감", "value": "6,400만" },
    { "key": "accident",   "label": "교통사고 예방", "value": "5,300만" },
    { "key": "congestion", "label": "도로혼잡 완화", "value": "8억 6,500만" }
  ],
  "cumulative": { "shippers": 128, "filledWagons": 1043 },
  "equivalents": { "pineTrees": 40000, "trucksBlocked": 45 }
}
```

---

## 3. 홈 대시보드 (STEP 03) (3개)

| # | Method | Path | 용도 | 비고 |
|---|---|---|---|---|
| 7 | GET | `/api/dashboard?persona=corp\|korail&period=2026Q2` | 상단 KPI 4장 + 보조금 예상액 + 편익 breakdown | persona별 KPI 라벨/값이 완전히 다름(공차율·채운화차·추가수익·신규화주 vs 감축·절감·편익·전환율). **응답에 label을 서버가 담아 보내야 함** |
| 8 | GET | `/api/matches?persona=&status=&page=` | AI 합적 매칭 현황 목록 | `route, wagon, sub, tons, loadRate, status(done\|group\|wait), saving` |
| 9 | GET | `/api/matches/{id}` | 행 펼침 상세 | 합적 파트너 / 출발 / 탄소 감축 / 환산 가치 |

> **최적화 제안:** 목록이 5행 고정이고 detail이 4쌍뿐이라 #9를 별도 호출로 두면 왕복만 늘어납니다. #8 응답에 `detail[]`을 인라인으로 포함시키고 #9는 만들지 않는 쪽을 권합니다. (행 수가 수십 건으로 늘면 그때 분리)

---

## 4. 화물 등록 (STEP 04a) (6개)

| # | 상태 | Method | Path | 용도 | LLM |
|---|---|---|---|---|---|
| 10 | ❌ | POST | `/api/freights/parse` | **자연어 문장 → 구조화 폼.** "울산에서 경기까지 8톤" → 6개 필드 | ✅ |
| 11 | ✅ | POST | `/api/freights` | 화물 등록 (위탁/자차 상태 포함) | |
| 12 | ❌ | POST | `/api/freights/bulk` | 엑셀 다건 등록 (multipart) | 파싱 결과 미리보기 후 확정하는 2단계 권장 |
| 13 | ✅ | GET | `/api/freights` | 화물 목록 (사이드바 "화물") | |
| 14 | ✅ | PATCH | `/api/freights/{id}` | 수정 (부분 수정 재검증) | |
| 15 | ✅ | DELETE | `/api/freights/{id}` | 삭제 | |

### #10이 이 서비스의 첫 번째 LLM 지점

화면에 **필드마다 "AI 자동입력" 뱃지가 붙고, 사용자가 손대면 뱃지가 사라지는** 인터랙션이 있습니다(`aiFields` state). 따라서 응답은 값만 주면 안 되고 **필드별 출처·신뢰도**를 함께 줘야 합니다.

```jsonc
// POST /api/freights/parse
// req: { "text": "울산 공장에서 경기 물류센터까지 석유화학제품 8톤, 다음주 화요일 출발" }
{
  "fields": {
    "origin":      { "value": "울산 공장",       "source": "ai", "confidence": 0.94 },
    "destination": { "value": "경기 물류센터",    "source": "ai", "confidence": 0.91 },
    "item":        { "value": "석유화학제품",     "source": "ai", "confidence": 0.88, "enum": "PETROCHEM" },
    "tons":        { "value": 8,                "source": "ai", "confidence": 0.97 },
    "departDate":  { "value": "2026-08-18",     "source": "ai", "confidence": 0.72 },
    "corpType":    { "value": null,             "source": "none" }  // 화면상 corp는 기본 false
  },
  "warnings": ["희망 출발일이 상대 날짜로 표현되어 추정했습니다"]
}
```

- `item`, `corpType`은 화면에서 **칩 선택(석유화학제품/화학원료/철강재/기타, 중소기업/우수물류기업/일반)** 이므로 자유 텍스트가 아니라 enum으로 강제해야 합니다. LLM 응답에 JSON Schema 또는 tool-use 강제 권장.
- 출발지·도착지는 최종적으로 **역 코드**로 정규화돼야 매칭이 돌아갑니다 → #40 마스터 참조.

---

## 5. 매칭 (STEP 04b · 04c) (5개)

| # | 상태 | Method | Path | 용도 | 비고 |
|---|---|---|---|---|---|
| 16 | ✅ | POST | `/api/matching/request` | AI 합적 매칭 요청 | 성립/미성립 분기. MatchResult 그대로 반환 |
| 17 | ⛔ | GET | `/api/matching/{jobId}` | 매칭 결과 조회 | 현재 sync — 불필요, 보류. 계산이 3초 넘으면 그때 job 분리 |
| 18 | ✅ | GET | `/api/wagons/vacancies` | 코레일 공차 현황 | 구간·출발·화차종류·정원·잔여. 시드 3량(단일 노선) |
| 19 | ✅ | POST | `/api/matching/confirm` | "코레일 공차 수송 확정" | 무상태라 확정 시 GRP-NNN 발급(플랫 경로). `acceptedShipmentIds`로 조율 수락 재매칭 |
| 20 | 🟡 | GET | `/api/matching/{id}/reconcilable` | 04c "조율 여지" 후보 | `negotiationCandidates`만 반환. conflict/lever 미보강 → 조율 브랜치 |

```jsonc
// POST /api/matching/request  → 미성립 케이스 (04c)
{
  "status": "FAILED",
  "reason": "MIN_LOAD_NOT_MET",
  "message": "합적 그룹을 만들지 못했습니다",
  "wagon": { "code": "KRC-1204", "route": "울산 → 의왕ICD",
             "departAt": "2026-08-18T06:20:00+09:00",
             "capacityTons": 4550, "minLoadRate": 0.60 },
  "current": { "tons": 1860, "loadRate": 0.41, "shortfallTons": 870 },
  "reconcilable": [
    { "shipper": "한림케미칼", "tons": 1540,
      "conflict": "희망 발송 08.17 · 화차 출발 08.18과 1일 어긋남",
      "lever": "DEPART_DATE_SHIFT" },
    { "shipper": "우진산업", "tons": 880,
      "conflict": "다음 주 예정 물량 · 이번 편성 대상 아님",
      "lever": "VOLUME_PULL_IN" },
    { "shipper": "남광유화", "tons": 720,
      "conflict": "부산신항 인도 필요 · 의왕ICD 인수 불가",
      "lever": "DELIVERY_STATION_CHANGE" }
  ]
}
```

> **주의:** `minLoadRate 60%`, 화차 정원, 절감률 산식은 **하드코딩된 상수가 아니라 설정값**으로 빼두세요. 심사 때 "이 60%는 어디서 나온 숫자냐"가 반드시 나옵니다.

---

## 6. 조율 에이전트 (STEP 04d · 04e) — 서비스의 핵심 (6개)

이 부분이 제품의 차별점이자 LLM 비중이 가장 큰 영역입니다. 화면에 **제약 분류 → 제안 생성 → 화주 회신 → 재제안 → 최종 편성**의 4단계 타임라인이 그려져 있습니다.

| # | Method | Path | 용도 | LLM |
|---|---|---|---|---|
| 21 | POST | `/api/negotiation/classify` | 화주 자연어 제약 → **절대조건 / 조정가능** 분류 | ✅ |
| 22 | POST | `/api/negotiation/run` | 조율 에이전트 실행 (타임라인 생성 시작) | ✅ |
| 23 | GET | `/api/negotiation/{id}/stream` | **SSE.** 적재율 41→75→94% 진행 | ✅ |
| 24 | POST | `/api/negotiation/{id}/proposals/{pid}/reply` | 화주 회신 입력 → 재제안 트리거 | ✅ |
| 25 | GET | `/api/negotiation/{id}` | 최종 편성 결과 | |
| 26 | POST | `/api/negotiation/{id}/cancel` | "다음 공차 일정 대기" | |

### #21 제약 분류 — 프롬프트 설계가 곧 제품 품질

```jsonc
// req
{ "shipper": "한림케미칼",
  "utterance": "22일까지 도착이면 됩니다. 창고 공간은 여유 있어요" }

// res
{
  "sensitivity": { "price": "HIGH", "leadTime": "LOW" },
  "constraints": [
    { "type": "ABSOLUTE",   "field": "arrivalDeadline", "value": "2026-08-22",
      "evidence": "22일까지 도착이면 됩니다" },
    { "type": "NEGOTIABLE", "field": "departDate", "range": "1~2일",
      "evidence": "창고 공간은 여유 있어요" }
  ]
}
```

### #22/#24의 비즈니스 규칙 — 반드시 서버에서 강제

화면에 **"양보 대가가 절감액보다 큰 화주에게는 제안하지 않습니다"** 라고 명시돼 있습니다. 이건 LLM에게 맡기면 안 되는 판단입니다. 보관비 620만 원 vs 절감 2,180만 원 같은 비교는 **결정적 계산으로 서버에서 먼저 필터링**하고, LLM은 통과한 건에 대해 **설득 문장만** 쓰게 하세요. (04e에 실제로 "보관비 620만 원 대비 절감 2,180만 원"이 근거로 표시됩니다)

```jsonc
// GET /api/negotiation/{id}/stream  — SSE 이벤트
event: loadRate    data: { "from": 0.41, "to": 0.75, "step": 1 }
event: proposal    data: { "shipper": "한림케미칼", "ask": "발송 2일 연기",
                           "status": "CONDITIONAL",
                           "narrative": "08.17 발송을 08.19로 옮기시면...",
                           "savingPct": 19 }
event: reply       data: { "shipper": "한림케미칼", "text": "2일은 어렵고 1일까지만 가능합니다" }
event: proposal    data: { "shipper": "한림케미칼", "ask": "1일 연기 재제안(08.18)",
                           "status": "ACCEPTED", "savingPct": 19,
                           "rationale": "보관비 620만 vs 절감 2,180만" }
event: done        data: { "finalLoadRate": 0.94, "groupId": "..." }
```

---

## 7. 편익 계산 (STEP 05) — 순수 계산, LLM 금지 (3개)

| # | Method | Path | 용도 | LLM |
|---|---|---|---|---|
| 27 | POST | `/api/benefits/calculate` | 도로 단독 vs 철도 합적 → 4대 편익 | ❌ 결정적 계산 |
| 28 | GET | `/api/benefits/summary?period=2026Q2` | 대시보드용 집계 | ❌ |
| 29 | GET | `/api/coefficients?year=2026` | 환경부 배출계수 · 사회적비용 단가 · KOTI 산식 파라미터 | ❌ |

```jsonc
// POST /api/benefits/calculate
{
  "comparison": {
    "road": { "cost": 508000000, "co2": 246, "loadRate": null },
    "rail": { "cost": 415000000, "co2": 64,  "loadRate": 0.94 },
    "costSavingPct": 18, "co2ReductionPct": 74
  },
  "benefits": [
    { "key": "ghg",        "basis": "182 tCO₂eq",        "source": "환경부 배출계수",        "amount": 158000000 },
    { "key": "airQuality", "basis": "NOx·SOx·PM2.5",      "source": "환경부 사회적비용 단가", "amount": 64000000 },
    { "key": "accident",   "basis": "대형화물차 45대 감소", "source": "KOTI 산식",            "amount": 53000000 },
    { "key": "congestion", "basis": "차량·km 감소분",      "source": "KOTI 산식",            "amount": 865000000 }
  ],
  "totalBenefit": 1140000000,
  "subsidyCap": { "rate": 0.30, "amount": 342000000,
                  "legalBasis": "국토교통부 고시 제2019-16호" },
  "equivalents": { "pineTrees": 40000, "trucksBlocked": 45 },
  "coefficientVersion": "MOE-2026.1"
}
```

> **#29를 반드시 별도 API로 분리하세요.** 계수는 매년 고시로 바뀌고, 신청서에 "계수 출처"를 명시해야 합니다. 계산 결과에 `coefficientVersion`을 박아두면 나중에 "왜 작년 신청서와 숫자가 다르냐"에 답할 수 있습니다.

---

## 8. 보조금 사업계획서 (STEP 06) (10개)

| # | Method | Path | 용도 | LLM |
|---|---|---|---|---|
| 30 | GET | `/api/subsidy/preflight?period=` | 06a "무엇이 만들어지나요" 5개 항목 준비 상태 | ❌ |
| 31 | POST | `/api/subsidy/applications` | 생성 시작 → `{ applicationId }` | |
| 32 | GET | `/api/subsidy/applications/{id}/stream` | **SSE.** 5단계 진행률 + 문단 6개 중 n번째 | ✅ |
| 33 | GET | `/api/subsidy/applications/{id}` | 완성 문서 조회 (1~6장) | |
| 34 | GET | `/api/subsidy/applications/latest` | 사이드바 재진입 시 초안 존재하면 06c로 직행 | |
| 35 | POST | `/api/subsidy/applications/{id}/regenerate` | 전체 재생성 | ✅ |
| 36 | POST | `/api/subsidy/applications/{id}/paragraphs/{key}/regenerate` | **문단 단위 재생성 (↻)** | ✅ |
| 37 | PATCH | `/api/subsidy/applications/{id}/paragraphs/{key}` | 문단 편집 저장 ("AI 서술 · 편집 가능") | |
| 38 | GET | `/api/subsidy/applications/{id}/revisions` | 변경 이력 | |
| 39 | GET | `/api/subsidy/applications/{id}/export?format=hwp\|pdf` | 다운로드 | |

### 문서 구조 = 응답 스키마

06c 화면이 **[별지 제3호 서식]** 을 그대로 재현하고 있어서, 응답을 자유 텍스트로 주면 안 되고 섹션별 구조체로 줘야 합니다. 그리고 화면에 **"자동 산출 수치" / "AI 서술" 범례가 색으로 구분**되어 있으므로 두 계열을 스키마에서 분리하세요.

```jsonc
// GET /api/subsidy/applications/{id}
{
  "meta": { "period": "2026-04-01~2026-06-30", "createdAt": "2026-08-12T14:32:00+09:00",
            "paragraphCount": 6, "form": "별지 제3호" },
  "sections": {
    "applicant":  { "type": "computed", "bizNo": "220-81-04512", "ceo": "이대성", ... },
    "plan":       { "type": "computed", "rows": [
                      { "route": "울산 → 의왕ICD", "item": "석유화학제품",
                        "tons": 1860, "trips": 5, "wagonType": "컨테이너" }, ...],
                    "total": { "items": 3, "tons": 4280, "trips": 12 } },
    "planNarrative": { "type": "ai", "key": "plan", "text": "당사는 2026년 2분기 중...",
                       "editable": true, "editedByUser": false },
    "extraCost":  { "type": "computed", "rows": [
                      { "label": "철도수송비", "formula": "4,280t × 96,500원", "amount": 413020000 },
                      { "label": "상하역비",   "formula": "12회 × 4,850,000원", "amount": 58200000 },
                      { "label": "셔틀운송비", "formula": "양단 42km × 12회",   "amount": 36780000 },
                      { "label": "도로수송비", "formula": "기존 도로 운송 실적 기준", "amount": -93000000 }],
                    "totalA": 415000000 },
    "benefit":    { "type": "computed", "totalB": 1140000000 },
    "benefitNarrative": { "type": "ai", "key": "benefit", "text": "본 전환을 통해..." },
    "result":     { "type": "computed", "A": 415000000, "B": 342000000,
                    "adopted": "B", "subsidy": 342000000,
                    "formula": "min(A, B) · 국토교통부 고시 제2019-16호" },
    "attachments": { "type": "computed", "items": [ "운송 실적 증빙 ...", ... ] },
    "closingNarrative": { "type": "ai", "key": "closing", "text": "당사는 본 사업으로..." }
  }
}
```

- **화면 하단 고정 문구 "수치는 법정 산식으로 계산되며, AI는 서술 문장만 작성합니다"가 곧 아키텍처 제약입니다.** `type: "computed"` 필드에는 LLM이 절대 개입하면 안 되고, LLM 프롬프트에는 이미 계산된 수치를 **입력으로 넣어 문장만 쓰게** 해야 합니다. 숫자를 LLM이 생성하게 두면 서식 제출 문서에 환각이 들어갑니다.
- **HWP 출력(#39)이 난이도 함정입니다.** 한글 문서 생성은 파이썬/자바 생태계에도 마땅한 오픈소스가 없습니다. MVP에서는 (a) PDF만 실제 구현하고 HWP는 버튼 비활성 + "준비 중", (b) HWPX(XML 기반)로 우회, (c) 서식을 채운 HTML→PDF 중 하나를 고르세요. 시연 시간 대비 (a) 또는 (c)를 권합니다.

---

## 9. K-ESG 리포트 (3개)

| # | Method | Path | 용도 | LLM |
|---|---|---|---|---|
| 40 | GET | `/api/esg/indicators?period=` | K-ESG 지표표 (E-3-2, E-7-1, E-3-3) | ❌ |
| 41 | POST | `/api/esg/report` | 공시 리포트 초안 문구 생성 · "다시 생성" | ✅ |
| 42 | GET | `/api/esg/scope3/export?format=csv\|xlsx` | Scope 3 데이터 내보내기 | ❌ |

---

## 10. 코레일 페르소나 · 마스터 (3개)

| # | Method | Path | 용도 |
|---|---|---|---|
| 43 | POST | `/api/korail/assignments/{id}/approve` | 화차 배정 승인 (코레일 담당자) |
| — | GET | `/api/master/stations` | 역 마스터 — 자연어 파싱 결과 정규화용 |
| — | GET | `/api/master/wagon-types` | 화차 종류 (컨테이너/유개/무개/탱크) |

> 코레일 페르소나의 KPI·매칭 목록은 #7·#8에서 `persona=korail`로 이미 커버됩니다. 별도 엔드포인트를 만들지 마세요.

---

## 11. 화면에 있지만 API가 아직 없는 것

시연 범위를 정할 때 참고하세요.

| 화면 요소 | 상태 | 판단 |
|---|---|---|
| 사이드바 **"정산"** 메뉴 | 화면 미구현 | MVP 제외. 메뉴만 두고 비활성 |
| 사이드바 **"설정"** 메뉴 | 화면 미구현 | MVP 제외 |
| 랜딩 **"요금" / "ESG 리포트"** 내비 | 링크만 존재 | 정적 페이지 or 앵커 |
| **비밀번호 찾기** | 링크만 존재 | MVP 제외 |
| **"최근 발행 · 2026년 1분기 리포트 PDF"** | 정적 표시 | #34로 대체 가능 |
| 랜딩 **소나무/트럭 이미지 슬롯** | `image-slot` 플레이스홀더 | 정적 에셋으로 교체 |

---

## 12. 구현 우선순위 (해커톤 기준)

시연 동선이 **랜딩 → 데모 로그인 → 대시보드 → 화물 등록 → 매칭 미성립 → 조율 → 편익 → 신청서**로 한 줄기이므로, 이 순서대로 막히지 않게 까는 게 우선입니다.

**P0 — 이게 없으면 시연이 끊김 (12개)**
`#3 demo` · `#6 public/stats` · `#7 dashboard` · `#8 matches` · `#10 parse` · `#11 freights` · `#16 matching/request` · `#22 negotiation/run` · `#23 negotiation/stream` · `#27 benefits/calculate` · `#31 subsidy 생성` · `#32 subsidy/stream`

**P1 — 심사위원이 눌러볼 가능성이 높음 (7개)**
`#21 classify` · `#24 reply` · `#29 coefficients` · `#33 조회` · `#36 문단 재생성` · `#39 export(PDF)` · `#41 esg/report`

**P2 — 나머지 24개.** 목록/수정/삭제·엑셀 업로드·변경 이력·코레일 승인은 시연 동선 밖입니다.

### 마지막으로 하나

LLM 8개 중 실제로 **품질이 승부를 가르는 건 #21(제약 분류)과 #22(설득 문장 생성)** 두 개뿐입니다. `#10 자연어 파싱`은 정규식 + enum 매칭으로도 시연에서는 충분히 그럴듯하게 돌아가고, 신청서 서술 문단은 톤이 정형적이라 프롬프트 한 번이면 끝납니다. 프롬프트 튜닝 시간을 조율 에이전트 쪽에 몰아주세요.
