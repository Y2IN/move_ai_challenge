/**
 * 서술 검사기 — **숫자가 아닌 것**을 잡는다.
 *
 * `verify.ts` 는 "입력에 없는 숫자"를 잡는다. 그런데 제출 문서를 망가뜨리는 문장은
 * 숫자가 없어도 나온다.
 *
 *   "제3자 검증기관의 검증을 받았습니다"   → 받은 적 없다. 허위기재다
 *   "탄소를 흡수하였습니다"                → 배출하지 않은 것이지 흡수한 게 아니다
 *   "획기적인 전환 사례입니다"             → 공시 문서에 홍보 수식어
 *   "지금 결정하지 않으면 기회가 없습니다"  → 화주 압박. 플랫폼이 할 말이 아니다
 *
 * 이 규칙들은 이미 **프롬프트에 금지사항으로 적혀 있다.** 그런데 프롬프트는
 * 지켜졌는지 알 수가 없다. `verify.ts` 헤더에 적은 것과 같은 논리다 —
 * 지시로 막고, 출력으로 확인한다. 확인이 없으면 지시는 희망사항이다.
 *
 * 검사는 **결정론적 정규식**이다. 심사자가 "그 판정은 누가 했냐"고 물으면
 * 규칙 목록을 그대로 보여줄 수 있어야 한다. LLM 에게 LLM 출력을 심사시키면
 * 같은 질문이 한 겹 뒤로 밀릴 뿐이고, 무료 티어에서는 요청 예산도 두 배가 된다.
 */

/** 위반 하나 */
export interface ClaimViolation {
  /** 규칙 id — 진단·테스트에서 이 값으로 특정한다 */
  rule: string;
  /** 실제로 걸린 문자열 */
  matched: string;
  /** 사람이 읽을 사유 */
  reason: string;
}

export interface ClaimReport {
  clean: boolean;
  violations: ClaimViolation[];
  /** 재생성 프롬프트에 그대로 넣는 지시문 */
  message: string;
}

export interface ClaimRule {
  rule: string;
  pattern: RegExp;
  reason: string;
  /**
   * 부정문 안에서 걸린 매칭을 무시할지.
   *
   * 한국어는 부정이 **문장 끝**에 온다. *"검증받은 실적으로 인용하여서는 안 된다"* 는
   * 검증을 주장하는 문장이 아니라 정반대를 말하는 문장인데, 정규식은 "검증받은"만
   * 보고 잡는다. 매칭 뒤쪽에 부정 표지가 있으면 주장이 아니라고 본다.
   *
   * 이 완화는 **놓치는 쪽**으로 기운다. 그래도 이렇게 두는 이유는 오탐 비용이 더
   * 크기 때문이다 — 정상 문단이 걸리면 그 문단은 AI 문장이 통째로 사라지고 폴백만
   * 남는다. 반대로 놓친 문장은 숫자 검증기와 사용자 편집이라는 다음 관문이 있다.
   */
  negatable?: boolean;
}

/** 문장 뒷부분에 이게 있으면 앞의 매칭은 주장이 아니다 */
const NEGATION = /않|못하|없다|없으며|없습니다|아니(?:다|라|며|고|었|ㅂ니다|랍니다)|안\s*된|말아야|마십시오|마라/;

/** 매칭 지점이 속한 문장의 **뒷부분**만 돌려준다 (부정은 뒤에 온다) */
function tailOfSentence(text: string, from: number): string {
  const end = text.slice(from).search(/[.!?\n]/);
  return end === -1 ? text.slice(from) : text.slice(from, from + end + 1);
}

/**
 * 공시·서식 문단용 규칙 (사업계획서 · K-ESG 리포트).
 *
 * ⚠️ 여기에 규칙을 추가할 땐 **오탐 비용**을 먼저 생각해야 한다. 잡히면 그 문단은
 *    재생성 1회를 쓰고, 그래도 걸리면 폴백 초안으로 떨어진다. 정상 문장을 잡는
 *    규칙은 AI 문단을 통째로 없애는 것과 같다.
 */
export const DISCLOSURE_RULES: ClaimRule[] = [
  {
    rule: "marketing",
    // "선도" 는 "선도적/선도한다" 로 쓰이지만 "선도물류" 같은 합성어가 없어 안전하다.
    pattern: /혁신적|획기적|선도적|최첨단|압도적|비약적|눈부신|최고의|유일한|(?:세계|국내|업계)\s*최초/g,
    reason: "공시 문서에 쓰지 않는 홍보성 수식어",
  },
  {
    rule: "unverified-assurance",
    // 제일 위험한 종류다. 검증받지 않은 것을 검증받았다고 쓰면 허위기재가 된다.
    //
    // ⚠️ **"검증" 이라는 단어 자체는 잡으면 안 된다.** 우리 공시 문단(K-ESG "4. 산정
    //    근거 및 검증")은 *"제3자 검증기관의 검증을 받지 않았다"* 를 명시하는 게 본문
    //    내용이고, 향후 계획 문단은 *"제3자 검증 절차를 순차적으로 진행"* 을 말한다.
    //    처음에 단어로 잡았더니 이 정상 문단들이 전부 폴백으로 떨어졌다.
    //
    //    그래서 **"받았다"는 완료형만** 잡는다. 부정("받지 않았다")·미래("받을 예정")는
    //    어미가 달라 자연히 빠진다.
    pattern:
      /(?:검증|인증|승인)(?:을|를)?\s*(?:받았|받은(?!\s*(?:바\s*)?없)|받아|취득(?:하였|했|한)|완료하였)|확인받(?:았|은)/g,
    reason: "검증·인증 사실이 없는데 받은 것처럼 서술",
    negatable: true,
  },
  {
    rule: "carbon-misuse",
    // 온실가스 "감축" 은 배출하지 않은 양이다. 흡수(sink)·상쇄(offset)는 다른 제도다.
    //
    // ⚠️ 여기서도 단어만 잡으면 안 된다. 우리 Scope 3 문단은 *"흡수하거나 상쇄한 양이
    //    아니라 배출하지 않은 양"* 이라고 **정확히 구분하는 문장**을 싣고 있고,
    //    소나무 환산 문장에는 *"소나무가 1년 동안 흡수하는 양"* 이 들어간다(이건 맞는
    //    표현이다 — 나무는 실제로 흡수한다). 둘 다 잡히면 안 된다.
    //
    //    잡아야 하는 건 **우리 배출을 흡수·상쇄했다고 주장하는 형태**뿐이다.
    pattern:
      /(?:탄소|온실가스|이산화탄소|배출량|배출분|감축분)(?:을|를)?\s*(?:전량\s*)?(?:흡수|상쇄)(?:하였|했|한다|합니다|하여|함)|탄소\s*중립을?\s*(?:달성|실현)/g,
    reason: "감축은 '배출하지 않은 양' — 흡수·상쇄로 쓰면 다른 제도가 된다",
    negatable: true,
  },
  {
    rule: "overpromise",
    pattern: /보장(?:합니다|한다|하며|드립)|반드시\s*달성|확실히\s*(?:달성|절감)|틀림없/g,
    reason: "계획을 확정 사실처럼 단정",
    negatable: true,
  },
  {
    rule: "format-leak",
    // 문단 본문만 달라고 했는데 제목·불릿·마크다운이 새어 나오는 경우.
    pattern: /(?:^|\n)\s*(?:#{1,6}\s|[-*]\s|\d+\.\s)|\*\*/g,
    reason: "문단 본문 외 서식(제목·목록·마크다운)이 포함됨",
  },
];

/**
 * 조율 제안 메시지용 규칙.
 *
 * 화주에게 나가는 문장이다. 압박·읍소는 **제품 신뢰를 깎는다** — 순이득이 남는
 * 제안만 보낸다는 게 이 기능의 전제인데, 압박 문구가 붙으면 그 전제가 무너져 보인다.
 */
export const PERSUASION_RULES: ClaimRule[] = [
  {
    rule: "pressure",
    pattern: /마지막\s*기회|지금\s*아니면|서둘러|놓치(?:면|시면)|더\s*이상\s*기다/g,
    reason: "화주 압박 표현",
  },
  {
    rule: "begging",
    pattern: /부디|간곡히|제발|어렵게\s*부탁/g,
    reason: "읍소 표현",
  },
  {
    rule: "marketing",
    pattern: /혁신적|획기적|파격적|최고의|유일한/g,
    reason: "과장 수식어",
  },
  {
    rule: "format-leak",
    pattern: /(?:^|\n)\s*(?:#{1,6}\s|[-*]\s)|\*\*|^["“'].*["”']$/g,
    reason: "본문 외 서식(제목·목록·따옴표 감싸기)이 포함됨",
  },
];

/**
 * 문장을 규칙에 걸어 본다.
 *
 * `allow` 로 규칙 id 를 넘기면 그 규칙은 건너뛴다. 실제로 제3자 검증을 받은
 * 원장이라면 `unverified-assurance` 를 풀어야 정상 문장이 살아난다
 * (`EsgAggregate.verified` 가 그 플래그다).
 */
export function inspectClaims(
  text: string,
  rules: ClaimRule[] = DISCLOSURE_RULES,
  allow: string[] = [],
): ClaimReport {
  const violations: ClaimViolation[] = [];
  const seen = new Set<string>();

  for (const { rule, pattern, reason, negatable } of rules) {
    if (allow.includes(rule)) continue;
    // 정규식에 g 플래그가 있어 lastIndex 가 남는다. 매번 새로 만들어 상태를 지운다.
    const re = new RegExp(pattern.source, pattern.flags);
    for (const m of text.matchAll(re)) {
      const matched = m[0].trim();
      if (negatable && NEGATION.test(tailOfSentence(text, (m.index ?? 0) + m[0].length))) {
        continue;
      }
      const key = `${rule}:${matched}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({ rule, matched, reason });
    }
  }

  return {
    clean: violations.length === 0,
    violations,
    message: violations.length
      ? `표현 규칙 위반 ${violations.length}건: ` +
        violations.map((v) => `"${v.matched}"(${v.reason})`).join(", ")
      : "표현 규칙을 모두 통과했습니다.",
  };
}

// ── 통합 게이트 ────────────────────────────────────────────────

import { findHallucinatedNumbers, type AllowedNumbers } from "./verify";

export interface OutputReport {
  clean: boolean;
  /** 입력에 근거가 없는 숫자 */
  offenders: string[];
  /** 표현 규칙 위반 */
  violations: ClaimViolation[];
  /** 진단·화면 표시용 사유 */
  message: string;
  /** 재작성 요청에 그대로 붙일 지시문. `clean` 이면 빈 문자열 */
  retryNote: string;
}

/**
 * 숫자 검사 + 표현 검사를 한 번에.
 *
 * **두 검사를 한 곳에 묶는 이유**는 재생성 예산 때문이다. 따로 돌려 순서대로
 * 재시도하면 한 문단에 최대 2회를 더 쓰는데, 무료 티어에서는 그게 곧 429다.
 * 한 번에 모아서 "숫자 X 와 표현 Y 를 둘 다 고쳐라"로 한 번만 다시 시킨다.
 */
export function inspectOutput(
  text: string,
  allowed: AllowedNumbers,
  rules: ClaimRule[] = DISCLOSURE_RULES,
  allow: string[] = [],
): OutputReport {
  const numbers = findHallucinatedNumbers(text, allowed);
  const claims = inspectClaims(text, rules, allow);
  const clean = numbers.clean && claims.clean;

  const parts: string[] = [];
  if (!numbers.clean) parts.push(numbers.message);
  if (!claims.clean) parts.push(claims.message);

  const notes: string[] = [];
  if (!numbers.clean) {
    notes.push(
      `- 주어진 수치에 없는 숫자를 썼다: ${numbers.offenders.join(", ")}. ` +
        `해당 숫자를 빼고 주어진 값만 쓰라. 확신이 없으면 숫자를 아예 쓰지 마라.`,
    );
  }
  if (!claims.clean) {
    notes.push(
      ...claims.violations.map((v) => `- "${v.matched}" 를 쓰지 마라 — ${v.reason}.`),
    );
  }

  return {
    clean,
    offenders: numbers.offenders,
    violations: claims.violations,
    message: clean ? "숫자·표현 검사를 모두 통과했습니다." : parts.join(" / "),
    retryNote: clean ? "" : notes.join("\n"),
  };
}
