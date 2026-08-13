import { PARAGRAPH_KEYS } from "@railhub/be/report/contract";
import { resolveReportInput } from "@railhub/be/report/source";
import {
  generateFallbackOnly,
  generateParagraphs,
  isClaudeConfigured,
} from "@railhub/be/report/generate";
import { find, replaceParagraph } from "@railhub/be/report/store";

/**
 * api_list #32 — 사업계획서 생성 진행률 (06b 화면, SSE).
 *
 * 화면이 **5단계 + "6개 문단 중 n번째"** 를 그린다. 그런데 문단은 병렬로 생성되므로
 * "4번째 문단 작성 중"이라는 표현은 정확하지 않다. 완료 개수로 진행률을 올린다.
 *
 * 계산 단계(1~4)는 이미 끝난 값을 읽는 것이라 즉시 지나가고,
 * 실제 시간은 5단계(문단 작성)에서 쓴다. 화면이 순식간에 지나가지 않도록
 * 계산 단계에 약간의 간격을 준다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STEP_GAP_MS = 400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 진행률 스트림은 **이미 만들어진 초안**을 채운다. 여기서 새 초안을 만들면
  // 스트림을 열 때마다 유령 초안이 하나씩 쌓이고 findLatest() 가 그걸 가리킨다.
  const app = find(id);
  if (!app) {
    return Response.json({ error: `초안을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  const input = app.input;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const pause = () => new Promise((r) => setTimeout(r, STEP_GAP_MS));

      try {
        // ── 1~4단계: 법정 산식 계산 결과 확인 (이미 계산된 값을 읽어 확인)
        const computedSteps = [
          {
            step: 1,
            label: "운송 실적 집계",
            detail: `${input.plan.total.tons}톤 · ${input.plan.total.trips}회`,
          },
          {
            step: 2,
            label: "배출계수 적용",
            detail: `탄소 감축 ${input.benefit.co2ReducedTon} tCO₂eq`,
          },
          {
            step: 3,
            label: "사회환경적 편익 산출",
            detail: `${input.benefit.totalB.toLocaleString("ko-KR")}원`,
          },
          {
            step: 4,
            label: "보조금 산정식 적용",
            detail: input.result.eligible
              ? `신청액 ${input.result.subsidy.toLocaleString("ko-KR")}원`
              : "전환 추가비용 미발생 — 신청 대상 아님",
          },
        ];

        send("start", {
          applicationId: id,
          totalSteps: computedSteps.length + 1,
          paragraphCount: PARAGRAPH_KEYS.length,
          eligible: input.result.eligible,
        });

        for (const s of computedSteps) {
          await pause();
          send("step", { ...s, status: "done" });
        }

        // ── 5단계: AI 서술 문단 (여기서 실제 시간이 든다)
        await pause();
        send("step", {
          step: 5,
          label: "서술 문단 작성",
          detail: `${PARAGRAPH_KEYS.length}개 문단`,
          status: "running",
        });

        const result = isClaudeConfigured()
          ? await generateParagraphs(input, (done, total, key) => {
              send("paragraph", {
                key,
                done,
                total,
                // 계산 4단계가 끝난 뒤부터 문단 진행률을 얹는다
                progress: Math.round(((computedSteps.length + done / total) / 5) * 100),
              });
            })
          : generateFallbackOnly(input);

        send("step", { step: 5, label: "서술 문단 작성", status: "done" });

        const at = new Date().toISOString();
        for (const key of PARAGRAPH_KEYS) {
          replaceParagraph(id, key, result.paragraphs[key], "generate", at);
        }
        app.diagnostics = result.diagnostics;

        send("done", {
          applicationId: app.id,
          progress: 100,
          fallbackCount: result.diagnostics.filter((d) => d.source === "fallback").length,
          document: app.document,
        });
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
