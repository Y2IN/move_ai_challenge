/**
 * `ReportInput` → 별지 제3호 서식 구조체.
 *
 * **이 파일은 수치를 계산하지 않는다.** 입력을 서식 배치에 맞게 옮겨 담기만 한다.
 * 문단(`paragraphs`)은 비워 둔 채로 나가고, Phase B에서 Claude가 채운다.
 */

import {
  PARAGRAPH_KEYS,
  type Paragraph,
  type ParagraphKey,
  type ReportInput,
  type SubsidyDocument,
} from "./contract";

const FORM_NAME = "별지 제3호";

/** 서식 6. 첨부 서류 — 고정 목록 */
const ATTACHMENTS = [
  "① 운송 실적 증빙 (코레일 화물운송 내역서)",
  "② 도로 운송 실적 비교표 (전년 동기 기준)",
  "③ 사업자등록증 사본",
  "④ 배출량 산정 근거자료 (배출계수 적용표)",
];

function emptyParagraph(key: ParagraphKey): Paragraph {
  return {
    type: "ai",
    key,
    text: "",
    source: "pending",
    editable: true,
    editedByUser: false,
  };
}

/**
 * 문단이 아직 없는 상태의 문서를 만든다.
 * 화면(06c)은 이 상태로도 **수치가 전부 채워진 서식**을 그릴 수 있다.
 */
export function buildDocument(
  input: ReportInput,
  createdAt: string,
  paragraphs?: Partial<Record<ParagraphKey, Paragraph>>,
): SubsidyDocument {
  const filled = {} as Record<ParagraphKey, Paragraph>;
  for (const key of PARAGRAPH_KEYS) {
    filled[key] = paragraphs?.[key] ?? emptyParagraph(key);
  }

  return {
    meta: {
      form: FORM_NAME,
      period: input.period,
      createdAt,
      paragraphCount: PARAGRAPH_KEYS.length,
      eligible: input.result.eligible,
      coefficientVersion: input.coefficientVersion,
    },
    sections: {
      applicant: { type: "computed", ...input.applicant },
      plan: { type: "computed", ...input.plan },
      extraCost: { type: "computed", ...input.extraCost },
      benefit: { type: "computed", ...input.benefit },
      result: { type: "computed", ...input.result },
      attachments: { type: "computed", items: ATTACHMENTS },
    },
    paragraphs: filled,
  };
}

/**
 * K-ESG 지표표는 **이 파일에서 만들지 않는다.**
 *
 * `BE/src/esg/` 모듈이 E-3-2 / E-7-1 / E-3-3 를 담당한다. 특히 E-7-1 은
 * 금액이 아니라 **물리량(kg)** 을 요구하는데 `ReportInput.benefit` 에는
 * 사회적 비용(원)만 있어서 여기서는 그 칸을 옳게 채울 수 없다.
 *
 * 공시 지표표 구현이 두 벌이면 서로 다른 숫자가 나온다. 한 곳으로 모은다.
 *   → `import { buildIndicators } from "../esg/indicators"`
 */
