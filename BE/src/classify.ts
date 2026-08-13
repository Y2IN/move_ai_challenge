/**
 * 화주 자연어 제약 → 절대조건/조정가능 분류 (#21) — **데모 버전 (LLM 미연결)**.
 *
 * 생성 AI 대신 규칙기반으로 발화를 분류한다. 날짜·키워드 패턴으로
 * arrivalDeadline(도착기한)·departDate(출발 조정)·요건(유개/주말/지게차)을 뽑고,
 * 가격/리드타임 민감도를 추정한다. 응답 `notice`에 데모 안내가 담긴다.
 *
 * LLM 붙일 땐 classifyConstraints 내부만 generateText() 호출로 교체(스키마 유지).
 */

import { seed } from "./seed";

export const DEMO_NOTICE =
  "데모 버전입니다 — LLM 대신 규칙기반으로 제약을 분류합니다. (규칙·예시를 추가해뒀어요)";

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
  demo: true;
  notice: string;
  shipper: string | null;
  sensitivity: { price: Sensitivity; leadTime: Sensitivity };
  constraints: ClassifiedConstraint[];
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

/** 분류 실행. utterance 를 직접 주거나, shipmentId 로 시드 발화를 끌어온다. */
export function classify(input: {
  utterance?: string;
  shipmentId?: string;
  shipper?: string;
}): ClassifyResult {
  let utterance = input.utterance?.trim() ?? "";
  let shipper = input.shipper ?? null;

  if (!utterance && input.shipmentId) {
    const s = seed.shipments.find((x) => x.id === input.shipmentId);
    if (s) {
      utterance = s.constraintText;
      shipper = seed.shippers.find((sp) => sp.id === s.shipperId)?.name ?? shipper;
    }
  }

  const { sensitivity, constraints } = classifyConstraints(utterance);
  return { demo: true, notice: DEMO_NOTICE, shipper, sensitivity, constraints };
}
