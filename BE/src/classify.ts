/**
 * 화주 자연어 제약 → 절대조건/조정가능 분류 (#21).
 *
 * **이 서비스에서 생성형 AI가 필요한 첫 번째 이유가 여기 있다.**
 * 같은 날짜 필드인데 *"월말 정산 때문에 25일 전에는 도착해야"* 는 절대 조건이고
 * *"앞뒤로 하루 이틀은 조정 가능"* 은 협상 카드다. 성격을 가르는 건 문장의 맥락뿐이라
 * 폼으로도, 정규식으로도 완전히는 못 짠다.
 *
 * **생성 AI 우선, 규칙 폴백.** 키가 없거나 호출이 실패하면 정규식 분류로 떨어진다.
 *
 * ## AI가 내놓은 분류를 그대로 믿지 않는다
 *
 * 분류 결과에 `evidence`(근거가 된 발화 조각)를 **반드시 함께** 내놓게 하고,
 * 그 조각이 **원문에 실제로 있는지 코드가 확인한다.** 없으면 그 제약을 버린다.
 *
 * 근거를 지어내는 순간 화면의 "왜 이걸 절대 조건으로 봤는지"가 거짓이 되고,
 * 화주는 하지도 않은 말 때문에 양보를 요구받는다. 조율에서 제일 위험한 실패다.
 */

import { generateText, isLlmConfigured } from "./llm";
import { seed } from "./seed";

export const DEMO_NOTICE =
  "데모 버전입니다 — LLM 대신 규칙기반으로 제약을 분류합니다. (규칙·예시를 추가해뒀어요)";

/** 생성 AI 가 실제로 분류했을 때의 안내 */
export const AI_NOTICE = "발화에서 제약을 분류했습니다. 근거 문구는 원문에서 확인한 것만 표시합니다.";

export type Sensitivity = "HIGH" | "MEDIUM" | "LOW";
export type ConstraintType = "ABSOLUTE" | "NEGOTIABLE";

export interface ClassifiedConstraint {
  type: ConstraintType;
  field: string;
  value?: string;
  range?: string;
  /** 근거가 된 발화 조각 */
  evidence: string;
}

export interface ClassifyResult {
  /** 규칙 경로로 나온 결과인지. `source === "rule"` 과 같다 */
  demo: boolean;
  /** 어느 경로로 나왔는지 */
  source: "ai" | "rule";
  notice: string;
  shipper: string | null;
  sensitivity: { price: Sensitivity; leadTime: Sensitivity };
  constraints: ClassifiedConstraint[];
  /** 근거 검사에서 걸러낸 항목이 있으면 그 사유 */
  warnings: string[];
}

/** 발화를 조각(clause)으로 나눠 정규식에 맞는 첫 조각을 근거로 돌려준다. */
function clauseContaining(text: string, re: RegExp): string {
  const clauses = text
    .split(/[.,!?\n·]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return clauses.find((c) => re.test(c)) ?? text.trim();
}

/** 규칙기반 분류 (데모 핵심) */
export function classifyConstraints(utterance: string): {
  sensitivity: { price: Sensitivity; leadTime: Sensitivity };
  constraints: ClassifiedConstraint[];
} {
  const t = utterance;
  const constraints: ClassifiedConstraint[] = [];

  // 1) 도착 기한 (절대) — "25일 전에는 도착", "22일까지 도착"
  if (/도착|인도|받아/.test(t)) {
    const clause = clauseContaining(t, /도착|인도|받아|까지|전/);
    const dm = clause.match(/(\d{1,2})\s*일/);
    if (dm) {
      constraints.push({
        type: "ABSOLUTE",
        field: "arrivalDeadline",
        value: `2026-08-${dm[1].padStart(2, "0")}`,
        evidence: clause,
      });
    }
  }

  // 2) 출발일 조정 가능 (조정가능)
  if (/조정|앞뒤로|하루\s*이?틀|이틀|여유/.test(t)) {
    constraints.push({
      type: "NEGOTIABLE",
      field: "departDate",
      range: "1~2일",
      evidence: clauseContaining(t, /조정|앞뒤로|이틀|여유/),
    });
  }

  // 3) 우천 노출 불가 (절대)
  if (/비\s*맞|유개|우천|녹|젖/.test(t)) {
    constraints.push({
      type: "ABSOLUTE",
      field: "requiresCover",
      value: "true",
      evidence: clauseContaining(t, /비\s*맞|유개|우천|녹|젖/),
    });
  }

  // 4) 주말 출발 불가 (절대)
  if (/주말|토\S?일|토요일|일요일/.test(t)) {
    constraints.push({
      type: "ABSOLUTE",
      field: "noWeekendDispatch",
      value: "true",
      evidence: clauseContaining(t, /주말|토\S?일|토요일|일요일/),
    });
  }

  // 5) 지게차 하역 (절대)
  if (/지게차|포크리프트/.test(t)) {
    constraints.push({
      type: "ABSOLUTE",
      field: "requiresForklift",
      value: "true",
      evidence: clauseContaining(t, /지게차|포크리프트/),
    });
  }

  const leadTime: Sensitivity = /여유|급하지\s*않|천천히|상관없/.test(t)
    ? "LOW"
    : /무조건|반드시|급|빨리/.test(t)
      ? "HIGH"
      : "MEDIUM";
  const price: Sensitivity = /저렴|절감|단가|비용|싸게|아끼|싼/.test(t) ? "HIGH" : "MEDIUM";

  return { sensitivity: { price, leadTime }, constraints };
}

/** 데모 예시 — 시드 화물의 실제 constraintText 를 그대로 노출한다. */
export function listClassifyExamples() {
  return seed.shipments
    .filter((s) => s.constraintText)
    .map((s) => ({
      shipmentId: s.id,
      shipper: seed.shippers.find((sp) => sp.id === s.shipperId)?.name ?? s.shipperId,
      utterance: s.constraintText,
    }));
}

/** 입력에서 발화와 화주명을 확정한다. 두 경로가 같은 걸 봐야 해서 따로 뺐다. */
function resolve(input: { utterance?: string; shipmentId?: string; shipper?: string }) {
  let utterance = input.utterance?.trim() ?? "";
  let shipper = input.shipper ?? null;

  if (!utterance && input.shipmentId) {
    const s = seed.shipments.find((x) => x.id === input.shipmentId);
    if (s) {
      utterance = s.constraintText;
      shipper = seed.shippers.find((sp) => sp.id === s.shipperId)?.name ?? shipper;
    }
  }
  return { utterance, shipper };
}

/** 규칙 경로. AI 가 없거나 실패했을 때 여기로 떨어진다. */
export function classify(input: {
  utterance?: string;
  shipmentId?: string;
  shipper?: string;
}): ClassifyResult {
  const { utterance, shipper } = resolve(input);
  const { sensitivity, constraints } = classifyConstraints(utterance);
  return {
    demo: true,
    source: "rule",
    notice: DEMO_NOTICE,
    shipper,
    sensitivity,
    constraints,
    warnings: [],
  };
}

// ── LLM 경로 ───────────────────────────────────────────────────

/** 화면과 조율 로직이 아는 필드만 허용한다. 여기 밖으로 나가면 조용히 무시된다. */
const FIELDS = [
  "arrivalDeadline",
  "departDate",
  "requiresCover",
  "noWeekendDispatch",
  "requiresForklift",
] as const;

const SYSTEM_PROMPT = `너는 화물 합적 플랫폼의 조율 담당자다. 화주가 말한 조건을 분류한다.

가르는 기준:
- ABSOLUTE(절대 조건) — 어기면 화물을 못 싣거나 화주 사업에 문제가 생기는 것.
  도착 기한, 우천 노출 불가, 주말 출발 불가, 하역 장비 요건.
- NEGOTIABLE(조정 가능) — 화주가 스스로 "조정 가능", "여유 있다", "상관없다"고 밝힌 것.

절대 규칙:
1. **evidence 는 입력 문장에서 잘라낸 그대로여야 한다.** 요약·의역·재작성 금지.
   원문에 없는 문구를 쓰면 그 제약은 버려진다.
2. 화주가 말하지 않은 제약을 만들지 마라. 짐작해서 채우지 마라.
3. field 는 주어진 목록 밖으로 나갈 수 없다.
4. 말하지 않은 것은 민감도를 MEDIUM 으로 둔다. HIGH/LOW 는 근거가 있을 때만.

같은 필드라도 성격이 갈린다:
  "월말 정산 때문에 25일 전에는 도착해야 합니다"  → ABSOLUTE  (사유 + 당위)
  "앞뒤로 하루 이틀은 조정 가능합니다"            → NEGOTIABLE (양보 표지 + 범위)`;

const CLASSIFY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    price: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    leadTime: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    constraints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["ABSOLUTE", "NEGOTIABLE"] },
          field: { type: "string", enum: [...FIELDS] },
          value: { type: ["string", "null"] },
          range: { type: ["string", "null"] },
          evidence: { type: "string" },
        },
        required: ["type", "field", "value", "range", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["price", "leadTime", "constraints"],
  additionalProperties: false,
};

/**
 * 근거 조각이 원문에 실제로 있는지.
 *
 * 공백만 다른 경우(모델이 띄어쓰기를 정리하는 일이 잦다)는 통과시킨다.
 * 그 외의 재작성은 통과시키지 않는다 — 의역을 허용하면 검사가 의미를 잃는다.
 */
function evidenceGrounded(utterance: string, evidence: string): boolean {
  const strip = (t: string) => t.replace(/\s+/g, "");
  return evidence.length > 0 && strip(utterance).includes(strip(evidence));
}

/** 생성 AI 로 분류한다. **실패하면 throw** — 호출부가 규칙 경로로 폴백한다. */
export async function classifyWithLlm(
  utterance: string,
  shipper: string | null,
): Promise<ClassifyResult> {
  const raw = await generateText({
    system: SYSTEM_PROMPT,
    prompt: [
      `[허용 field] ${FIELDS.join(", ")}`,
      `[입력 발화]`,
      utterance,
    ].join("\n"),
    maxTokens: 1024,
    thinking: "low",
    jsonSchema: CLASSIFY_SCHEMA,
    timeoutMs: 20_000,
  });

  const r = JSON.parse(raw) as {
    price?: unknown;
    leadTime?: unknown;
    constraints?: unknown;
  };

  const level = (v: unknown): Sensitivity =>
    v === "HIGH" || v === "LOW" ? v : "MEDIUM";

  const constraints: ClassifiedConstraint[] = [];
  const warnings: string[] = [];

  for (const raw of Array.isArray(r.constraints) ? r.constraints : []) {
    const c = raw as Record<string, unknown>;
    const evidence = typeof c.evidence === "string" ? c.evidence.trim() : "";

    // 근거 검사 — 원문에 없는 조각을 붙인 제약은 버린다.
    // 버렸다는 사실은 숨기지 않는다. 이 화면에서 제일 중요한 정보다.
    if (!evidenceGrounded(utterance, evidence)) {
      warnings.push(`근거 문구가 원문에 없어 제외했습니다 — "${evidence || "(비어 있음)"}"`);
      continue;
    }
    if (typeof c.field !== "string" || !(FIELDS as readonly string[]).includes(c.field)) continue;
    if (c.type !== "ABSOLUTE" && c.type !== "NEGOTIABLE") continue;

    constraints.push({
      type: c.type,
      field: c.field,
      ...(typeof c.value === "string" && c.value ? { value: c.value } : {}),
      ...(typeof c.range === "string" && c.range ? { range: c.range } : {}),
      evidence,
    });
  }

  return {
    demo: false,
    source: "ai",
    notice: AI_NOTICE,
    shipper,
    sensitivity: { price: level(r.price), leadTime: level(r.leadTime) },
    constraints,
    warnings,
  };
}

/** 분류 실행 — **AI 우선, 규칙 폴백.** utterance 또는 shipmentId 를 받는다. */
export async function classifyConstraintText(input: {
  utterance?: string;
  shipmentId?: string;
  shipper?: string;
}): Promise<ClassifyResult> {
  const { utterance, shipper } = resolve(input);

  if (utterance && isLlmConfigured()) {
    try {
      return await classifyWithLlm(utterance, shipper);
    } catch {
      const fallback = classify(input);
      return {
        ...fallback,
        warnings: ["AI 분류에 실패해 규칙기반 결과로 대체했습니다."],
      };
    }
  }
  return classify(input);
}
