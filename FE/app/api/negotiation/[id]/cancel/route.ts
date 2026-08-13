import { seed } from "@railhub/be/seed";
import { cancelNegotiation } from "@railhub/be/store";

// 조율 취소 "다음 공차 일정 대기" (#26). 세션을 cancelled 로 두고 다음 공차를 안내.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/negotiation/{id}/cancel */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const record = cancelNegotiation(id);
  if (!record) {
    return Response.json({ error: `조율 세션을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }

  // 다음 출발 공차 안내 (가장 이른 출발)
  const next = [...seed.emptyWagons].sort((a, b) =>
    `${a.departure.date} ${a.departure.time}`.localeCompare(`${b.departure.date} ${b.departure.time}`),
  )[0];

  return Response.json({
    id: record.id,
    status: record.status,
    message: "조율을 취소했습니다. 다음 공차 일정을 기다립니다.",
    nextWagon: next
      ? { id: next.id, label: next.label, departAt: `${next.departure.date} ${next.departure.time}` }
      : null,
  });
}
