import { buildDocument } from "@railhub/be/report/document";
import { resolveReportInput } from "@railhub/be/report/source";
import { find } from "@railhub/be/report/store";

/**
 * api_list #33 — 완성 문서 조회 (06c 화면).
 *
 * 저장된 초안이 있으면 그걸 주고, 없으면 **문단이 비어 있는 서식**을 만들어 준다.
 * 후자여도 수치는 전부 채워져 나가므로 화면이 그려진다.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const app = await find(id);

  if (app) {
    return Response.json({
      applicationId: app.id,
      stage: "generated",
      document: app.document,
      diagnostics: app.diagnostics,
      revisionCount: app.revisions.length,
    });
  }

  // 저장된 초안이 없으면 **수치만 채운 빈 서식**을 만들어 준다.
  // 저장하지 않는다 — 조회가 초안을 만들어 버리면 findLatest() 가 오염된다.
  const source = await resolveReportInput();
  return Response.json({
    applicationId: id,
    stage: "draft",
    inputOrigin: source.origin,
    inputNote: source.reason ?? null,
    document: buildDocument(source.input, new Date().toISOString()),
  });
}
