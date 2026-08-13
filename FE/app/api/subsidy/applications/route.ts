import { buildDocument } from "@railhub/be/report/document";
import { resolveReportInput } from "@railhub/be/report/source";
import {
  generateFallbackOnly,
  generateParagraphs,
  isLlmConfigured,
} from "@railhub/be/report/generate";
import { nextApplicationId, save } from "@railhub/be/report/store";
import type { ShipmentInput } from "@railhub/be/types";

/**
 * api_list #31 — 사업계획서 생성 시작 (06a "보고서 초안 생성" 버튼).
 *
 * 문단 6개를 병렬로 생성한다. 생성 AI 호출이 실패하거나 인증이 없으면
 * 규칙기반 폴백 문장으로 채우고 문서는 정상적으로 나간다.
 *
 * 수치는 실제 매칭·계산에서 가져온다(`resolveReportInput`). 편성이 확정되지 않았거나
 * 계산이 실패하면 fixture 로 떨어지고, 응답의 `inputOrigin` 으로 어느 쪽인지 알려준다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { shipment?: ShipmentInput; trips?: number; now?: string }
    | null;

  // 실제 계산으로 만들고, 편성이 확정 안 됐거나 계산이 실패하면 fixture 로 떨어진다.
  const source = resolveReportInput({
    shipment: body?.shipment ?? null,
    trips: body?.trips,
    now: body?.now ? new Date(body.now) : undefined,
  });
  const input = source.input;
  const { paragraphs, diagnostics } = isLlmConfigured()
    ? await generateParagraphs(input)
    : generateFallbackOnly(input);

  const now = new Date().toISOString();
  const app = await save({
    id: await nextApplicationId(),
    input,
    document: buildDocument(input, now, paragraphs),
    diagnostics,
    createdAt: now,
    updatedAt: now,
    revisions: [],
  });

  return Response.json({
    applicationId: app.id,
    // 수치가 실계산인지 고정값인지 화면이 알아야 한다
    inputOrigin: source.origin,
    inputNote: source.reason ?? null,
    document: app.document,
    diagnostics: app.diagnostics,
  });
}
