import { find } from "@railhub/be/report/store";

/** api_list #38 — 변경 이력 (06c "변경 이력" 버튼). */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const app = await find(id);
  if (!app) {
    return Response.json({ error: `초안을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }
  return Response.json({ applicationId: id, revisions: app.revisions });
}
