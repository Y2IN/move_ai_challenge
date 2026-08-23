import { commitBulk, previewBulk } from "@railhub/be/bulk";
import { loadUniverse } from "@railhub/be/db/universe";

// 화물 다건 등록 (#12). CSV 를 미리보기(검증만) → 확정(등록) 2단계로.
// 입력: multipart(file, commit) / application/json({csv, commit}) / text/csv(raw)
export const dynamic = "force-dynamic";

/** POST /api/freights/bulk */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let csv = "";
  let commit = false;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file instanceof File) csv = await file.text();
      else if (typeof form.get("csv") === "string") csv = String(form.get("csv"));
      commit = form.get("commit") === "true";
    } else if (contentType.includes("application/json")) {
      const body = (await req.json()) as { csv?: unknown; commit?: unknown };
      csv = typeof body.csv === "string" ? body.csv : "";
      commit = body.commit === true;
    } else {
      csv = await req.text(); // raw CSV
    }
  } catch {
    return Response.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!csv.trim()) {
    return Response.json(
      { error: "CSV 내용이 비어 있습니다. 헤더 + 1행 이상이 필요합니다." },
      { status: 400 },
    );
  }

  // 검증 기준은 매칭 유니버스와 같아야 한다 (역 코드가 늘면 대량 등록도 따라가야 함)
  const universe = await loadUniverse();
  const result = commit ? await commitBulk(csv, universe) : previewBulk(csv, universe);
  return Response.json(result, { status: commit ? 201 : 200 });
}
