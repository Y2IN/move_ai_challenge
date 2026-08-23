/**
 * 서술 검사기 회귀 테스트. 실행: npm run test:guard -w BE
 *
 * 검사기는 **두 방향으로 다 틀릴 수 있다.**
 *
 *   못 잡으면  → 허위 서술이 제출 문서에 그대로 실린다
 *   과잉 검출  → 정상 문장이 매번 폴백으로 떨어져 AI 문단이 사라진다
 *
 * 그래서 "잡혀야 하는 문장"과 "통과해야 하는 문장"을 같은 수로 둔다.
 * 아래 정상 문장에는 **우리가 실제로 쓰는 폴백 초안**이 전부 들어간다 —
 * 폴백이 검사기에 걸리는 규칙은 어떤 경로로도 통과할 수 없는 규칙이다.
 */

import { PARAGRAPHS, fallbackText } from "../esg/paragraphs";
import { aggregate, parsePeriod } from "../esg/period";
import { fixtureReportInput as fx } from "./fixture";
import {
  DISCLOSURE_RULES,
  PERSUASION_RULES,
  inspectClaims,
  inspectOutput,
} from "./guard";
import { PARAGRAPH_SPECS } from "./paragraphs";
import { collectAllowedNumbers } from "./verify";

let pass = 0;
let fail = 0;

function check(
  label: string,
  text: string,
  shouldBeClean: boolean,
  rules = DISCLOSURE_RULES,
  allow: string[] = [],
) {
  const r = inspectClaims(text, rules, allow);
  const ok = r.clean === shouldBeClean;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} [${shouldBeClean ? "통과해야" : "잡혀야"} 함] ${label}`);
  if (!ok || !shouldBeClean) console.log(`     → ${r.message}`);
}

console.log("── 잡혀야 하는 서술 (공시·서식) ──");

check("검증 안 받았는데 받았다고", "제3자 검증기관으로부터 감축량을 확인받았습니다.", false);
check("인증 취득 주장", "국제 인증을 취득하였습니다.", false);
check("홍보 수식어", "당사의 획기적인 전환 사례입니다.", false);
check("업계 선도 표현", "선도적 물류 기업으로서 전환을 추진하였습니다.", false);
check("탄소 흡수 오용", "본 전환으로 탄소를 흡수하였습니다.", false);
check("상쇄 오용", "발생 배출량을 전량 상쇄하였습니다.", false);
check("탄소중립 달성 단정", "본 사업으로 탄소 중립을 달성하였습니다.", false);
check("결과 보장", "향후 동일한 감축을 보장합니다.", false);
check("마크다운 누출", "## 사업 개요\n당사는 전환을 추진하였습니다.", false);
check("불릿 누출", "- 전환 물량\n- 감축량", false);

console.log("\n── 통과해야 하는 서술 (오탐이면 AI 문단이 사라진다) ──");

check("평서형 사실 서술", "당사는 보고 기간 중 화물을 철도로 전환하였습니다.", true);
check("감축 표현 정상", "해당 구간에서 발생하였을 온실가스가 감축되었습니다.", true);
check("예정 표현", "감축분은 Scope 3 항목에 반영할 예정입니다.", true);
check("검증 계획 아닌 서술", "산정 결과는 계수 출처와 함께 기재하였습니다.", true);
check("'선도' 없는 유사어", "간선 물류의 철도 분담률을 높여 나가고자 합니다.", true);

// ↓ 아래 다섯 개는 실제로 오탐이 났던 문장들이다. 전부 우리 폴백 초안에 들어 있고,
//   단어만 보는 규칙에서는 정상 문단이 통째로 폴백으로 떨어졌다.
check("부정문 안의 검증 언급", "제3자 검증기관의 검증을 받지 않았다.", true);
check("검증 인용 금지 안내", "검증받은 실적으로 인용하여서는 안 된다.", true);
check("검증 계획", "제3자 검증 절차를 순차적으로 진행하여 신뢰성을 높인다.", true);
check("나무는 실제로 흡수한다", "소나무 1,000그루가 1년 동안 흡수하는 양에 상당한다.", true);
check("감축과 흡수를 구분하는 문장", "흡수하거나 상쇄한 양이 아니라 배출하지 않은 양이다.", true);
check(
  "실제 검증받은 원장이면 허용",
  "제3자 검증기관의 검증을 받은 원장을 근거로 작성하였습니다.",
  true,
  DISCLOSURE_RULES,
  ["unverified-assurance"],
);

console.log("\n── 우리 폴백 초안은 전부 통과해야 한다 ──");

for (const [key, spec] of Object.entries(PARAGRAPH_SPECS)) {
  check(`사업계획서 폴백 · ${key}`, spec.fallback(fx), true);
}

const agg = aggregate({ period: parsePeriod("2026Q2") });
for (const spec of PARAGRAPHS) {
  // 폴백 초안은 회전한다. 회전분 전부가 통과해야 한다 — 한 개만 검사하면
  // 재생성 두 번째에 걸리는 초안을 놓친다.
  for (let variant = 0; variant < 3; variant++) {
    check(`K-ESG 폴백 · ${spec.key} #${variant}`, fallbackText(spec, agg, variant), true);
  }
}

console.log("\n── 조율 메시지 규칙 ──");

check("압박", "지금 아니면 기회가 없습니다.", false, PERSUASION_RULES);
check("읍소", "부디 협조해 주시기 바랍니다.", false, PERSUASION_RULES);
check("정상 제안", "8월 22일 예정 물량을 3일 당겨 주실 수 있는지 문의드립니다.", true, PERSUASION_RULES);

console.log("\n── 통합 게이트: 숫자 + 표현을 한 번에 잡는다 ──");

{
  const allowed = collectAllowedNumbers(fx);
  const r = inspectOutput(
    "당사는 획기적인 전환으로 182 tCO₂eq 를 감축하였습니다.",
    allowed,
  );
  const ok = !r.clean && r.offenders.length > 0 && r.violations.length > 0;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} 숫자 환각과 표현 위반이 한 번에 보고된다`);
  console.log(`     → ${r.message}`);

  // 재작성 지시문에 두 사유가 다 들어가야 재시도 1회로 끝난다.
  const hasBoth = r.retryNote.includes("182") && r.retryNote.includes("획기적");
  hasBoth ? pass++ : fail++;
  console.log(`${hasBoth ? "✅" : "❌"} 재작성 지시문이 두 사유를 모두 담는다`);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail > 0) process.exitCode = 1;
