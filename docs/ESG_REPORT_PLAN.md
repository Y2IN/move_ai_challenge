# ESG 리포트 · 보조금 사업계획서 — 작업 플랜

담당 범위: api_list.md **§8 보조금 사업계획서(#30~#39)** + **§9 K-ESG 리포트(#40~#42)**
화면 범위: **STEP 06a / 06b / 06c**
브랜치: `feat/esg-report`

---

## 0. 대전제 — 계산이 확정되기 전에 시작한다

계산식은 아직 팀 논의 중이다. 그런데 리포트 작업은 **계산이 끝나기를 기다릴 필요가 없다.**
조건은 하나, **입력 계약(contract)을 먼저 못박는 것**이다.

```
[계산 담당]  match → calc  ──▶  ReportInput  ──▶  [내 담당] 문단 생성 → 서식 조립 → 내보내기
                                    ▲
                              여기만 합의하면 끝
```

- 계수가 바뀌든 산식이 바뀌든 **`ReportInput` 모양만 유지되면 리포트 코드는 한 줄도 안 고친다**
- 계산이 안 붙은 동안은 `fixture.ts`(고정 입력)로 개발한다. 06c 화면을 끝까지 완성할 수 있다
- 시연 당일 계산이 터져도 fixture로 리포트 단독 시연이 가능하다 — **보험이 하나 생긴다**

> **첫 번째 할 일은 코드가 아니라 계약 합의다.** 계산 담당에게 "이 타입 채워서 넘겨줘" 하고 §1을 보여줄 것.

---

## 1. 계약 — `ReportInput`

```ts
// BE/src/report/contract.ts
export interface ReportInput {
  period: { from: string; to: string; label: string }; // "2026-04-01", "2026-06-30", "2026년 2분기"

  applicant: {
    // 06c 1. 신청인 — 계산과 무관, 계정 정보
    name: string;
    bizNo: string;
    ceo: string;
    manager: string;
    phone: string;
    address: string;
  };

  plan: {
    // 06c 2. 전환 계획
    rows: {
      route: string;
      item: string;
      tons: number;
      trips: number;
      wagonType: string;
    }[];
    total: {
      itemCount: number;
      tons: number;
      trips: number;
      wagonTypeCount: number;
    };
    avgLoadRate: number; // 서술 문단이 인용함
  };

  extraCost: {
    // 06c 3. 추가비용 산출
    rows: { label: string; formula: string; amount: number }[];
    totalA: number; // 음수 가능 — §4 참고
  };

  benefit: {
    // 06c 4. 사회환경적 편익
    items: {
      key: string;
      label: string;
      basis: string;
      source: string;
      amount: number;
    }[];
    totalB: number;
    co2ReducedTon: number;
    co2ReductionRate: number;
    equivalents: { pineTrees: number; trucksBlocked: number };
  };

  result: {
    // 06c 5. 보조금 산정 결과
    A: number;
    B: number;
    adopted: "A" | "B" | "none";
    subsidy: number;
    eligible: boolean; // false면 문단 톤이 완전히 달라짐
    legalBasis: string;
  };

  coefficientVersion: string; // "MOE-2026.1" — 서식에 출처로 박힘
}
```

**협의 포인트 3개** (계산 담당과 먼저 맞출 것):

| 항목                                   | 왜 중요한가                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `extraCost.totalA` 가 음수일 수 있는가 | 철도가 도로보다 싸면 추가비용이 음수 → 보조금 0. 문단 톤이 정반대가 된다 |
| `result.eligible` 를 계산이 판정하는가 | 리포트가 판정하면 안 된다. 법정 판단은 계산 쪽 책임                      |
| `benefit.items[].source` 문자열        | 서식에 그대로 인쇄된다. 계수 출처 표기는 계산이 소유                     |

---

## 2. 폴더 구조

```
BE/src/report/
  contract.ts     // ReportInput — 계산팀과의 유일한 접점
  fixture.ts      // 계산 없이 개발·시연하기 위한 고정 입력
  paragraphs.ts   // 문단 6개 정의 + 프롬프트
  generate.ts     // Gemini 호출 · 병렬 · 폴백
  verify.ts       // 숫자 환각 검출기 (§4)
  kesg.ts         // K-ESG 지표표 매핑 (E-3-2 / E-7-1 / E-3-3)
  document.ts     // ReportInput + 문단 → 별지 제3호 서식 구조체
  export/html.ts  // 인쇄용 HTML (PDF는 브라우저 인쇄로)

FE/app/api/subsidy/applications/...   // #31~#39
FE/app/api/esg/...                    // #40~#42
```

---

## 3. 작업 순서

### Phase A — 계약 + 스텁 · LLM 없이 06c를 끝까지 그린다

1. `contract.ts` 작성 → **계산 담당과 합의** ← 여기가 블로커. 먼저 처리
2. `fixture.ts` — 고정 입력. **디자인 06c의 숫자를 베끼지 말 것** (예시 데이터라 값에 근거가 없다).
   현재 계산 엔진(`calc.ts`)을 시드로 한 번 돌린 출력을 그대로 박아두고, 계수가 확정되면 다시 뽑아 교체한다
3. `document.ts` — `ReportInput` → 서식 구조체. 문단 자리는 빈 문자열
4. `#33 GET /api/subsidy/applications/{id}` → fixture 기반 응답
5. **06c 화면이 수치까지 다 채워져서 뜬다.** 문단만 비어 있는 상태

> Phase A가 끝나면 계산이 늦어져도 내 작업은 안 막힌다.

### Phase B — 문단 생성 (Gemini)

6. `paragraphs.ts` — 문단 6개 정의
7. `generate.ts` — 병렬 호출 + 폴백
8. `verify.ts` — 숫자 환각 검출
9. `#31 생성 시작` · `#35 전체 재생성` · `#36 문단 단위 재생성(↻)`

### Phase C — 진행 스트리밍 (06b)

10. `#32 SSE` — 5단계 진행률 + "6개 문단 중 n번째"

### Phase D — 편집 · 이력

11. `#37 문단 편집 저장` — `editedByUser: true` 로 마크(재생성 시 덮어쓰기 경고)
12. `#34 latest` — 사이드바 재진입 시 초안 있으면 06c 직행
13. `#38 변경 이력`

### Phase E — K-ESG + 내보내기

14. `#40 지표표` · `#41 리포트 문구` — 06c의 두 번째 탭
15. `#39 export(PDF)` · `#42 Scope 3 CSV`

**우선순위:** Phase A → B → C 까지가 시연 필수. D·E는 남는 시간에.
api_list P0에 `#31`·`#32`, P1에 `#33`·`#36`·`#39`·`#41`이 걸려 있는 것과 일치한다.

---

## 4. 핵심 설계 결정

### 4.1 숫자는 LLM이 절대 만들지 않는다 — 환각 검출기

디자인 06a/06b/06c 하단에 **"수치는 법정 산식으로 계산되며, AI는 서술 문장만 작성합니다"** 가 고정 문구로 박혀 있다. 이건 카피가 아니라 **아키텍처 제약**이다. 관할 지자체에 제출하는 서식에 환각 숫자가 들어가면 서비스가 끝난다.

방어를 두 겹으로 둔다.

1. **입력 제한** — 프롬프트에 이미 계산된 수치를 넣고 "문장만 쓰라"고 지시. 숫자 생성 금지를 명시
2. **출력 검증** — 생성된 문장에서 숫자를 전부 뽑아, 입력에 없는 값이면 **재생성**

```ts
// verify.ts
export function findHallucinatedNumbers(
  text: string,
  allowed: Set<string>,
): string[] {
  const found = text.match(/[\d,]+(?:\.\d+)?/g) ?? [];
  return found
    .map((n) => n.replace(/,/g, ""))
    .filter((n) => n.length > 1) // 한 자리 수는 서수("2분기")라 제외
    .filter((n) => !allowed.has(n));
}
```

`allowed` 는 `ReportInput` 을 재귀 순회해서 만든다. 원본 값 + 억/만 단위 표기 + 반올림 표기까지 넣어야 오탐이 안 난다.

> **심사 방어 포인트.** "AI가 숫자를 지어내면 어떡하냐"는 질문이 반드시 나온다. 검출기가 있으면 한 문장으로 끝난다.

### 4.2 문단 6개 — 병렬 호출

06b가 "약 10초", "6개 문단 중 4번째"라고 명시한다. Vercel serverless 기본 제한이 있어 **순차 6회는 위험**하다. `Promise.all` 로 병렬 호출하고, 완료되는 대로 SSE 이벤트를 쏜다.

| key         | 위치            | 인용하는 수치          |
| ----------- | --------------- | ---------------------- |
| `overview`  | 사업 개요       | period, plan.total     |
| `plan`      | 2. 전환 계획 뒤 | plan.rows, avgLoadRate |
| `extraCost` | 3. 추가비용 뒤  | extraCost.totalA       |
| `benefit`   | 4. 편익 뒤      | co2ReducedTon, totalB  |
| `result`    | 5. 산정 결과 뒤 | A, B, adopted, subsidy |
| `closing`   | 6. 기대효과     | plan.total, 향후 계획  |

06c 화면에 보이는 서술은 3개(`plan`·`benefit`·`closing`)뿐인데 06b는 6개라고 한다.
→ **06a의 "사업 개요·기대효과 문장 작성" 문구 기준으로 6개가 맞다.** 화면에 안 보이는 3개는 서식 본문에만 들어간다. 최신 디자인 받으면 재확인 필요.

### 4.3 `eligible: false` 분기를 반드시 만든다

추가비용이 음수면(= 철도가 도로보다 싸면) 고시상 보조금 대상이 아니다. 이때 문단이 "보조금을 신청합니다"라고 쓰면 문서가 틀린다.

프롬프트를 두 벌 준비한다.

- `eligible: true` → 보조금 신청 논조
- `eligible: false` → "전환 추가비용이 발생하지 않아 보조금 신청 대상이 아니며, 산출된 편익은 Scope 3 공시 자산으로 활용한다" 논조

> 지금 계산 엔진을 시드 데이터로 돌리면 **실제로 `eligible: false` 가 나온다.** 예외 케이스가 아니라 기본 케이스일 수 있으니 먼저 만들어 둘 것.

### 4.4 폴백 — 해커톤 와이파이는 못 믿는다

Gemini 호출 실패 시 **템플릿 문장**으로 자동 대체하고 `source: "fallback"` 을 붙인다. 화면은 그대로 뜨고 배지만 달라진다. 문서 생성이 통째로 죽는 것보다 훨씬 낫다.

### 4.5 HWP는 버리고 PDF만

api_list §8 지적대로 한글 문서 생성은 마땅한 오픈소스가 없다. **서식 HTML → 브라우저 인쇄(`window.print()`)** 로 PDF를 뽑고, HWP 버튼은 비활성 + "준비 중" 툴팁으로 둔다. 별지 제3호 서식은 표 위주라 인쇄 CSS로 충분히 재현된다.

---

## 5. 지금 막혀 있는 것

| #   | 항목                                     | 누구에게                                   |
| --- | ---------------------------------------- | ------------------------------------------ |
| 1   | `ReportInput` 계약 합의                  | 계산 담당 — **최우선**                     |
| 2   | 보조금 중심 / ESG 자산 중심 중 카피 방향 | 기획 — 문단 프롬프트 톤이 갈린다           |
| 3   | 04c·04d·04e 있는 최신 디자인 파일        | 디자인 — 문단 6개 확인용                   |
| 4   | 신청인 정보(사업자번호 등) 출처          | 계정 담당 — 회원가입 필드인지 하드코딩인지 |

1번만 풀리면 Phase A는 바로 시작할 수 있다. 2·3·4는 Phase B 전까지만 정해지면 된다.
