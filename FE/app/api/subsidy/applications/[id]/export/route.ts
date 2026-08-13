import { renderSubsidyHtml } from "@railhub/be/report/export/html";
import { find } from "@railhub/be/report/store";

/**
 * api_list #39 — 문서 내보내기.
 *
 * `format=html`  인쇄용 서식 HTML (기본)
 * `format=pdf`   같은 HTML 을 `print=1` 로 열어 브라우저 인쇄 대화상자를 띄운다
 * `format=hwp`   미지원. 한글 문서 생성은 마땅한 오픈소스가 없어 501 로 명시한다
 *
 * 화면에서는 HWP 버튼을 비활성 + "준비 중" 으로 두고, PDF 만 실제로 동작시킨다.
 */
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "html";

  if (format === "hwp") {
    return Response.json(
      {
        error: "HWP 내보내기는 지원하지 않습니다.",
        reason: "한글 문서 생성에 쓸 만한 오픈소스 라이브러리가 없습니다.",
        alternative: "?format=pdf 로 브라우저 인쇄를 사용하세요.",
      },
      { status: 501 },
    );
  }
  if (format !== "html" && format !== "pdf") {
    return Response.json(
      { error: `지원하지 않는 형식: ${format}`, allowed: ["html", "pdf"] },
      { status: 400 },
    );
  }

  // 없는 초안을 200 으로 렌더하면 형제 라우트(404)와 동작이 갈린다.
  const app = await find(id);
  if (!app) {
    return Response.json({ error: `초안을 찾을 수 없습니다: ${id}` }, { status: 404 });
  }

  const html = renderSubsidyHtml(app.document, format === "pdf");

  // 경로 세그먼트를 응답 헤더에 그대로 넣지 않는다.
  const safeId = id.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `inline; filename="subsidy-${safeId}.html"`,
    },
  });
}
