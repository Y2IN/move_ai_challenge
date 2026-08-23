import { loadUniverse } from "@railhub/be/db/universe";
import { cancelNegotiation } from "@railhub/be/store";

// 조율 취소 "다음 공차 일정 대기" (#26). 세션을 cancelled 로 두고 다음 공차를 안내.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/negotiation/{id}/cancel */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const record = await cancelNegotiation(id);
  if (!record) {
    return Response.json({ error: `조율 세션을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }

  // 다음 출발 공차 안내 — **아직 마감 전인 것 중 가장 이른 출발**.
  // 예전에는 정렬만 하고 첫 항목을 집어서 이미 떠난 화차를 "다음 공차"로 안내했다.
  // 유니버스는 DB 를 우선하므로 대시보드에서 추가한 화차도 함께 잡힌다.
  const data = await loadUniverse();
  const now = Date.now();
  const next = data.emptyWagons
    .filter((w) => new Date(w.cutoffAt).getTime() > now)
    .sort((a, b) =>
      `${a.departure.date} ${a.departure.time}`.localeCompare(`${b.departure.date} ${b.departure.time}`),
    )[0];

  return Response.json({
    id: record.id,
    status: record.status,
    message: next
      ? "조율을 취소했습니다. 다음 공차 일정을 기다립니다."
      : "조율을 취소했습니다. 지금은 모집 중인 공차가 없어 다음 배차를 기다려야 합니다.",
    nextWagon: next
      ? { id: next.id, label: next.label, departAt: `${next.departure.date} ${next.departure.time}` }
      : null,
  });
}
