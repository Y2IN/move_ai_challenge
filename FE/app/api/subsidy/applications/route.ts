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
 *
 * ── `defer: true` — 문단을 만들지 않고 빈 서식만 발급 ──────────────
 *
 * 06b(생성 중) 화면은 SSE 로 문단이 하나씩 채워지는 걸 보여준다. 그러려면
 * **스트림을 열기 전에 초안 id 가 있어야 한다** (EventSource 는 POST 를 못 한다).
 * 그렇다고 여기서 문단까지 만들어 버리면 06b 가 스트림을 열 때 같은 문단을
 * 한 번 더 생성하게 되어 LLM 호출이 두 배가 된다 — 무료 티어 분당 한도에서는
 * 그 자체로 429 를 부른다.
 *
 * 그래서 `defer` 는 수치만 계산해 `source: "pending"` 상태의 빈 서식을 저장하고,
 * 실제 문단 생성은 06b 의 스트림이 맡는다 (`[id]/stream`).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { shipment?: ShipmentInput; trips?: number; now?: string; defer?: boolean }
    | null;

  // 실제 계산으로 만들고, 편성이 확정 안 됐거나 계산이 실패하면 fixture 로 떨어진다.
  const source = await resolveReportInput({
    shipment: body?.shipment ?? null,
    trips: body?.trips,
    now: body?.now ? new Date(body.now) : undefined,
  });
  const input = source.input;

  // defer 면 문단 자리를 비워 둔다. buildDocument 가 pending 문단으로 채운다.
  const deferred = body?.defer === true;
  const { paragraphs, diagnostics } = deferred
    ? { paragraphs: undefined, diagnostics: [] }
    : isLlmConfigured()
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
    // 문단이 아직 비어 있음을 화면이 구분할 수 있어야 한다
    stage: deferred ? "pending" : "generated",
    document: app.document,
    diagnostics: app.diagnostics,
  });
}
