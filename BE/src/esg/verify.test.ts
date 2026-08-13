/**
 * K-ESG 문단(#41)에 대한 숫자 환각 검출 테스트.
 *
 * 실행: npm run test:esg -w BE
 *
 * `report/verify.test.ts` 는 보조금 서식(§8) 입력을 검사합니다. 이 파일은 **§9 ESG 문단**
 * 입력을 검사합니다. ESG 문단에는 §8 에 없는 함정이 두 개 있습니다.
 *
 *   1. 공시 기준 이름에 숫자가 박혀 있다 — "GRI 305-3", "ISO 14064-3", "IFRS S2"
 *   2. 물질명에 숫자가 박혀 있다 — "PM2.5"
 *
 * 둘 다 문장 속 수치가 아니라 고유명사인데 검출기는 구분하지 못합니다. 등록해 두지
 * 않으면 **정상 문장이 매번 환각으로 잡혀 대기오염·검증 문단이 영구히 폴백**으로
 * 떨어집니다. 검출기가 안 잡는 것보다 오탐이 더 위험한 이유가 이것입니다.
 *
 * 손으로 만든 가짜 입력 대신 `buildFacts(aggregate(...))` 실제 출력을 씁니다.
 * buildFacts 에서 물질명이나 기준 표기가 빠지면 여기서 잡힙니다.
 */

import { buildIndicators, SCOPE3_CATEGORY } from "./indicators";
import { buildFacts, fallbackText, PARAGRAPHS } from "./paragraphs";
import { aggregate, parsePeriod } from "./period";
import { collectAllowedNumbers, findHallucinatedNumbers } from "../report/verify";

const agg = aggregate({ period: parsePeriod("2026Q2") });
const facts = buildFacts(agg);
const indicators = buildIndicators(agg);

// narrative.ts 가 실제로 등록하는 것과 동일하게 구성합니다.
const standards = [
  ...PARAGRAPHS.map((p) => p.standard),
  ...indicators.flatMap((i) => i.frameworks),
  SCOPE3_CATEGORY,
];
// narrative.ts 와 동일하게 **프롬프트 입력만** 등록합니다.
// agg 전체를 넣으면 모델이 못 본 화주별 상세값까지 허용되어 검출기가 헐거워집니다.
const allowed = collectAllowedNumbers({ facts, standards });

let pass = 0;
let fail = 0;

function check(label: string, text: string, shouldBeClean: boolean) {
  const r = findHallucinatedNumbers(text, allowed);
  const ok = r.clean === shouldBeClean;
  ok ? pass++ : fail++;
  const mark = ok ? "✅" : "❌";
  const want = shouldBeClean ? "통과해야" : "잡혀야";
  console.log(`${mark} [${want} 함] ${label}`);
  if (!ok) console.log(`     → ${r.message}`);
  else if (!shouldBeClean) console.log(`     → 잡힘: ${r.offenders.join(", ")}`);
}

console.log(`집계: ${agg.period.label} · 편성 ${agg.tripCount}회 · ${agg.totalTon}톤`);
console.log(`allowed 집합 크기: ${allowed.size}\n`);

console.log("── 정상 문장 (오탐 나면 검출기가 무력화됨) ──");
check("수송 실적 인용", `총 ${agg.tripCount}회 편성으로 ${agg.totalTon}톤을 수송하였다.`, true);
check(
  "배출량 인용",
  `기준선 ${agg.baselineCo2Ton} tCO₂eq 대비 ${agg.reducedCo2Ton} tCO₂eq를 감축하였다.`,
  true,
);
check("감축률 인용", `감축률은 ${(agg.reductionRate * 100).toFixed(1)}%이다.`, true);
check("천단위 콤마", `사회환경적 편익은 ${agg.totalBenefitKrw.toLocaleString("ko-KR")}원이다.`, true);
check("만 단위 축약", "금전 환산액은 약 24만원이다.", true);
check("GRI·ISSB 인용", "GRI 305-3 및 ISSB IFRS S2 Scope 3 Cat.4 에 따라 산정하였다.", true);
check("ISO 인용", "ISO 14064-3 에 따른 제3자 검증은 실시하지 않았다.", true);
check("K-ESG 코드", "K-ESG E-3-2 및 E-7-1 지표에 대응한다.", true);
check("물질명 PM2.5", "PM2.5 저감량은 미미하나 유의미한 방향성을 보인다.", true);
check("물질명 전체", "NOx, SOx, PM2.5 배출량이 모두 감소하였다.", true);
check("계수 버전", `적용 계수는 버전 ${agg.coefficientVersion} 로 고정되어 있다.`, true);
check("한 자리 수", "총 3개 노선에서 5개 화주가 참여하였다.", true);
check("기간 표기", `${agg.period.label} (${agg.period.from} ~ ${agg.period.to}) 실적이다.`, true);

console.log("\n── 환각 (반드시 잡혀야 함) ──");
check("지어낸 감축량", "본 전환으로 1,250 tCO₂eq를 감축하였다.", false);
check("지어낸 목표", "2030년까지 배출량을 45% 감축할 계획이다.", false);
check("지어낸 금액", "편익은 총 87,500,000원에 달한다.", false);
check("지어낸 대수", "대형 화물차 1,430대의 도심 진입을 차단하였다.", false);
check("지어낸 비교", "전년 동기 대비 38.2% 개선되었다.", false);
check("지어낸 검증 실적", "제3자 검증기관으로부터 99.7%의 정확도를 확인받았다.", false);

// ── 부호 표기 정합성 ───────────────────────────────────────────
//
// 대기오염물질은 **증가할 수 있습니다** (디젤 견인은 후처리 장치가 없어 연료당 배출이 많고,
// 철도 간선거리가 도로보다 길면 연료 효율 이득이 상쇄됨).
// 증가분을 "감축"으로 인쇄하면 허위 공시입니다. 계수가 바뀌어도 이 규칙은 유지돼야 합니다.
console.log("\n── 부호 표기 (증가를 감축으로 쓰면 허위 공시) ──");

function assert(label: string, condition: boolean, _unused = true) {
  condition ? pass++ : fail++;
  console.log(`${condition ? "✅" : "❌"} ${label}`);
}

const air = indicators.find((i) => i.code === "E-7-1")!;
const increased = agg.pollutants.filter((p) => p.reducedKg < 0);
const decreased = agg.pollutants.filter((p) => p.reducedKg >= 0);

/** 문단 하나의 폴백 초안 전부. 한 벌만 검사하면 나머지는 무검증으로 화면에 나갑니다. */
const draftsOf = (key: string) => {
  const spec = PARAGRAPHS.find((p) => p.key === key)!;
  return spec.fallbacks.map((_, v) => fallbackText(spec, agg, v));
};

console.log(
  `  현재 계수 기준: 감소 ${decreased.map((p) => p.label).join("·") || "없음"} / ` +
    `증가 ${increased.map((p) => p.label).join("·") || "없음"}`,
);

assert(
  "증감 지표에 부호가 붙는다",
  air.metrics.filter((m) => m.label.includes("증감")).every((m) => /^[+−]/.test(m.value)),
  true,
);
assert("'감축량' 이라고 단정하는 라벨이 없다", !air.metrics.some((m) => m.label.includes("감축량")), true);

const airDrafts = draftsOf("airQuality");

if (increased.length > 0) {
  assert("헤드라인 단위가 실제 방향과 일치", air.headlineUnit.includes("증가") === (agg.pollutants.find((p) => p.key === "nox")!.reducedKg < 0), true);
  assert("지표 근거에 증가 사실이 적혀 있다", air.basis.includes("증가"), true);
  assert("증가한 물질이 지표에 나열된다", increased.every((p) => air.metrics.some((m) => m.value.includes(p.label))), true);
  // 초안이 여러 벌이므로 **전 벌**을 검사합니다. 한 벌이라도 증가를 감추면
  // 재생성 버튼이 "듣기 좋은 문장 뽑기"가 됩니다.
  assert(`모든 초안(${airDrafts.length}벌)이 '증가' 를 명시한다`, airDrafts.every((t) => t.includes("증가")), true);
  assert(
    "모든 초안이 증가 원인(후처리 장치)을 설명한다",
    airDrafts.every((t) => t.includes("DPF") || t.includes("매연저감")),
    true,
  );
  assert(
    "모든 초안이 '모두 감소' 로 시작하지 않는다",
    airDrafts.every((t) => !t.startsWith("수송수단 전환에 따라 대기오염물질 배출량도 함께 감소")),
    true,
  );
  assert(
    "증가한 물질이 모든 초안에 이름으로 나온다",
    airDrafts.every((t) => increased.every((p) => t.includes(p.label))),
    true,
  );
} else {
  assert("전 물질 감소 시 모든 초안이 감소로 서술한다", airDrafts.every((t) => t.includes("감소")), true);
}

assert(
  "온실가스 초안은 전 벌이 감축으로 서술된다 (CO₂는 확실히 감소)",
  agg.reducedCo2Ton > 0 && draftsOf("scope3").every((t) => t.includes("감축")),
  true,
);

// ── 폴백 초안 전수 검사 ────────────────────────────────────────
//
// 폴백은 재생성 때마다 다른 벌이 나옵니다. 검출기를 통과하지 않은 초안이 한 벌이라도
// 섞여 있으면, 그 벌이 뽑히는 순간 근거 없는 숫자가 공시 문서에 인쇄됩니다.
// 폴백 경로에는 재생성 방어선이 없으므로(이미 최후 경로입니다) 여기서 고정합니다.
console.log("\n── 폴백 초안 전수 검사 (모든 벌이 검출기를 통과해야 함) ──");

for (const spec of PARAGRAPHS) {
  const drafts = spec.fallbacks.map((_, v) => fallbackText(spec, agg, v));
  drafts.forEach((text, v) => check(`${spec.key} 초안 ${v + 1}/${drafts.length}`, text, true));
  assert(
    `${spec.key} 초안 ${drafts.length}벌이 서로 다르다 (같으면 재생성이 멈춘 화면으로 보임)`,
    new Set(drafts).size === drafts.length,
    true,
  );
  assert(`${spec.key} 초안이 2벌 이상이다`, drafts.length >= 2, true);
}

// 호출자는 단조 증가 카운터를 그대로 넘깁니다. 인덱스가 범위를 넘거나 음수여도
// 던지지 않고 유효한 초안이 나와야 합니다.
const rotate = PARAGRAPHS[0];
assert(
  "회전 인덱스가 범위를 넘어도 처음으로 되돌아온다",
  fallbackText(rotate, agg, rotate.fallbacks.length) === fallbackText(rotate, agg, 0),
  true,
);
assert("음수 인덱스도 유효한 초안을 준다", fallbackText(rotate, agg, -1).length > 0, true);

console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
