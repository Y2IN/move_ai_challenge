import { getNegotiation } from "@railhub/be/store";

// 조율 진행률 스트리밍 (#23, SSE). LLM·재계산 없이 저장된 NEG 세션 결과를
// 단계별 이벤트로 재생한다 (04d 적재율 애니메이션용).
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** GET /api/negotiation/{id}/stream */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const record = getNegotiation(id);
  if (!record) {
    return Response.json({ error: `조율 세션을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  const result = record.result;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const capacity = result.before.capacityTon;
      let ton = result.before.totalTon;
      let load = capacity ? ton / capacity : 0;

      send("start", { negotiationId: id, feasible: result.feasible, loadRate: round2(load) });
      await wait(400);

      for (let i = 0; i < result.proposals.length; i++) {
        const p = result.proposals[i];
        // 제안 제시
        send("proposal", {
          step: i + 1,
          shipper: p.shipperName,
          lever: p.lever,
          ask: p.ask,
          conflict: p.conflict,
          narrative: p.message,
          savingKrw: p.savingKrw,
          status: "CONDITIONAL",
        });
        await wait(700);

        // 수락 반영 → 적재율 상승
        const from = load;
        ton += p.weightTon;
        load = capacity ? ton / capacity : load;
        send("loadRate", { from: round2(from), to: round2(load), step: i + 1 });
        send("proposal", { step: i + 1, shipper: p.shipperName, status: "ACCEPTED", savingKrw: p.savingKrw });
        await wait(600);
      }

      send("done", {
        finalLoadRate: round2(result.after ? result.after.loadRate : load),
        feasible: result.feasible,
        message: result.message,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
