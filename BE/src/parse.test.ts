/**
 * 상대 날짜 해석 회귀 테스트. 실행: npm run test:parse -w BE
 *
 * "모레"·"다음주 토요일"·"금주까지" 같은 표현을 **코드가 유일한 기준**으로 환산한다.
 * LLM 은 날짜 산수를 가끔 틀리므로, 여기서 고정한 값이 AI 결과를 덮어쓴다 (`parse.ts`).
 *
 * 오늘 날짜를 고정해서 돌린다 — 서버 시각을 쓰면 요일에 따라 결과가 흔들린다.
 */

import { parseFreightText, resolveDates, resolveRelativeDate } from "./parse";

// 2026-08-24 은 월요일. 로컬 자정으로 만들어 UTC 변환에 하루가 밀리지 않게 한다.
const MON = new Date(2026, 7, 24);

let pass = 0;
let fail = 0;

function assert(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}${ok ? "" : `  → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

// ── 1. 하루 단위 표현 ────────────────────────────────────────
console.log("── 오늘/내일/모레 ──");
assert("오늘", resolveRelativeDate("오늘 출발", MON), "2026-08-24");
assert("내일", resolveRelativeDate("내일 출발 희망", MON), "2026-08-25");
assert("명일", resolveRelativeDate("명일 출발", MON), "2026-08-25");
assert("모레", resolveRelativeDate("모레 출발이면 됩니다", MON), "2026-08-26");
assert("글피", resolveRelativeDate("글피 출발", MON), "2026-08-27");
assert("사흘 뒤", resolveRelativeDate("사흘 뒤 출발", MON), "2026-08-27");
assert("나흘 후", resolveRelativeDate("나흘 후 출발", MON), "2026-08-28");
assert("이레 뒤", resolveRelativeDate("이레 뒤 출발", MON), "2026-08-31");
assert("5일 후", resolveRelativeDate("5일 후 출발", MON), "2026-08-29");
assert("10일 뒤 (두 자리)", resolveRelativeDate("10일 뒤 출발", MON), "2026-09-03");
assert("월말 넘김", resolveRelativeDate("8일 뒤 출발", MON), "2026-09-01");

// ── 2. 요일 + 주 표현 ────────────────────────────────────────
console.log("── 요일 · 금주/차주 ──");
assert("다음주 토요일", resolveRelativeDate("다음주 토요일 출발", MON), "2026-09-05");
assert("차주 토요일", resolveRelativeDate("차주 토요일 출발", MON), "2026-09-05");
assert("담주 토요일", resolveRelativeDate("담주 토요일 출발", MON), "2026-09-05");
assert("다음 주 (띄어쓰기) 토요일", resolveRelativeDate("다음 주 토요일 출발", MON), "2026-09-05");
assert("금주 목요일", resolveRelativeDate("금주 목요일 출발", MON), "2026-08-27");
assert("이번주 목요일", resolveRelativeDate("이번주 목요일 출발", MON), "2026-08-27");
assert("이번 주 일요일 (주 마지막 날)", resolveRelativeDate("이번 주 일요일 출발", MON), "2026-08-30");
assert("차주 월요일 (주 첫 날)", resolveRelativeDate("차주 월요일 출발", MON), "2026-08-31");
assert("요일만 → 가까운 토요일", resolveRelativeDate("토요일 출발", MON), "2026-08-29");
assert("요일만, 오늘이 그 요일 → 오늘", resolveRelativeDate("월요일 출발", MON), "2026-08-24");

// 오늘이 주 중간(수요일)일 때도 '이번주 월요일'은 지난 월요일이어야 한다 (월요일 시작 기준)
const WED = new Date(2026, 7, 26);
assert("수요일 기준 이번주 월요일 = 지난 월요일", resolveRelativeDate("이번주 월요일 출발", WED), "2026-08-24");
assert("수요일 기준 요일만 월요일 = 다음 월요일", resolveRelativeDate("월요일 출발", WED), "2026-08-31");
// 일요일은 그 주의 마지막 날이다. 다음날(월)이 새 주.
const SUN = new Date(2026, 7, 30);
assert("일요일 기준 이번주 = 여전히 같은 주", resolveRelativeDate("이번주 월요일 출발", SUN), "2026-08-24");
assert("일요일 기준 차주 월요일 = 내일", resolveRelativeDate("차주 월요일 출발", SUN), "2026-08-31");

// ── 3. 주 단위 마감 ──────────────────────────────────────────
console.log("── 금주까지 / 차주 안에 ──");
assert("금주까지 → 이번주 일요일", resolveDates("금주까지 출발", MON).depart, "2026-08-30");
assert("이번 주 안에 → 이번주 일요일", resolveDates("이번 주 안에 출발", MON).depart, "2026-08-30");
assert("차주까지 → 다음주 일요일", resolveDates("차주까지 출발", MON).depart, "2026-09-06");
assert("다음주 안에 → 다음주 일요일", resolveDates("다음주 안에 출발", MON).depart, "2026-09-06");

// ── 4. 출발 vs 도착 ──────────────────────────────────────────
console.log("── 출발 절 / 도착 절 구분 ──");
{
  const r = resolveDates("금주까지 도착", MON);
  assert("도착만 → depart 없음", r.depart, null);
  assert("도착만 → arrival 은 이번주 일요일", r.arrival, "2026-08-30");
}
{
  const r = resolveDates("울산에서 의왕까지 화학원료 12톤, 이번 주 안에 도착만 하면 됩니다", MON);
  assert("데모 케이스 문장 — 출발일 지어내지 않음", r.depart, null);
  assert("데모 케이스 문장 — 도착 기한은 잡힘", r.arrival, "2026-08-30");
}
{
  const r = resolveDates("부산에서 수도권까지 화학원료 12톤, 금요일까지 도착 필요", MON);
  assert("프롬프트 예시 문장 — 출발일 null", r.depart, null);
  assert("프롬프트 예시 문장 — 도착은 금요일", r.arrival, "2026-08-28");
}
{
  const r = resolveDates("모레 출발, 금요일까지 도착", MON);
  assert("둘 다 → 출발은 모레", r.depart, "2026-08-26");
  assert("둘 다 → 도착은 금요일", r.arrival, "2026-08-28");
}
{
  // 절 순서가 바뀌어도 각자 제 절을 찾아야 한다
  const r = resolveDates("금요일까지 도착해야 하고, 출발은 모레", MON);
  assert("순서 바뀜 → 출발은 모레", r.depart, "2026-08-26");
  assert("순서 바뀜 → 도착은 금요일", r.arrival, "2026-08-28");
}
assert("단서 없는 날짜는 출발로 본다", resolveRelativeDate("철강재 3톤 모레", MON), "2026-08-26");
assert("출발 단서 다양 — 보내", resolveRelativeDate("모레 보내주세요", MON), "2026-08-26");
assert("출발 단서 다양 — 상차", resolveRelativeDate("내일 상차", MON), "2026-08-25");
assert("도착 단서 다양 — 입고", resolveDates("내일 입고", MON).depart, null);
assert("도착 단서 다양 — 납품", resolveDates("차주 금요일 납품", MON).depart, null);

// ── 4b. 원문 표현 캡처 — 화면이 "'내일' → 8월 25일" 로 그린다 ──
console.log("── 표현 캡처 ──");
assert("departExpr — 내일", resolveDates("철강재 3톤 내일 출발", MON).departExpr, "내일");
assert("departExpr — 다음주 토요일", resolveDates("다음주 토요일 출발", MON).departExpr, "다음주 토요일");
assert("departExpr — 띄어쓰기 보존", resolveDates("다음 주 토요일 출발", MON).departExpr, "다음 주 토요일");
assert("departExpr — 5일 후", resolveDates("5일 후 출발", MON).departExpr, "5일 후");
assert("arrivalExpr — 금주까지", resolveDates("금주까지 도착", MON).arrivalExpr, "금주까지");
assert("표현 없음 → departExpr null", resolveDates("철강재 3톤", MON).departExpr, null);

// ── 5. 없는 표현 ─────────────────────────────────────────────
console.log("── 해당 없음 ──");
assert("표현 없음 → null", resolveRelativeDate("울산에서 오봉까지 철강재 3톤", MON), null);
assert("절대 날짜만 → null (LLM 이 처리)", resolveRelativeDate("9월 3일 출발", MON), null);
assert("'일요일' 의 '일' 이 N일 뒤로 오인되지 않음", resolveRelativeDate("일요일 출발", MON), "2026-08-30");

// ── 6. 규칙(폴백) 경로에 실제로 반영되는가 ───────────────────
console.log("── parseFreightText 통합 ──");
{
  // '석유화학' 키워드로 매칭되는 케이스는 departOffsetDays=2 (모레) 가 박혀 있다.
  // 문장이 '내일' 이면 케이스 값이 아니라 문장 기준이어야 한다.
  const r = parseFreightText({ text: "울산 공장에서 경기 의왕까지 석유화학제품 8톤, 내일 출발" });
  const tomorrow = resolveRelativeDate("내일", new Date());
  assert("문장의 '내일' 이 케이스의 '모레' 를 덮어쓴다", r.fields.departDate.value, tomorrow);
  assert("출처는 ai 로 표시", r.fields.departDate.source, "ai");
}
{
  const r = parseFreightText({ text: "울산화물역에서 경기 의왕까지 화학원료 12톤, 이번 주 안에 도착만 하면 됩니다" });
  assert("도착 기한만 → 출발일 비움", r.fields.departDate.value, null);
  assert("도착 기한만 → warning 에 사유", r.warnings.some((w) => w.includes("도착 기한")), true);
  assert("도착 기한만 → dateResolution.kind = arrival", r.dateResolution?.kind, "arrival");
  assert("도착 기한만 → dateResolution.expression", r.dateResolution?.expression, "이번 주 안에");
}
{
  const r = parseFreightText({ text: "울산 공장에서 경기 의왕까지 석유화학제품 8톤, 다음주 토요일 출발" });
  assert("dateResolution.kind = depart", r.dateResolution?.kind, "depart");
  assert("dateResolution.expression", r.dateResolution?.expression, "다음주 토요일");
  assert("dateResolution.date 가 폼 값과 같다", r.dateResolution?.date, r.fields.departDate.value);
  assert("dateResolution.today 는 YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(r.dateResolution?.today ?? ""), true);
}
{
  const r = parseFreightText({ text: "울산 공장에서 경기 의왕까지 석유화학제품 8톤" });
  assert("표현 없으면 dateResolution null", r.dateResolution, null);
}
{
  // caseId 로 직접 고른 경우는 예시 문장을 그대로 쓰는 것이니 케이스 값을 신뢰한다
  const r = parseFreightText({ caseId: "petrochem-uls-obong" });
  const dayAfterTomorrow = resolveRelativeDate("모레", new Date());
  assert("caseId 선택 → 케이스 오프셋(모레) 유지", r.fields.departDate.value, dayAfterTomorrow);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
