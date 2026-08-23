import { badJson, readBody } from "@railhub/be/http";
import { saveUpload } from "@railhub/be/db/settlement-docs";
import { loadUniverse } from "@railhub/be/db/universe";

/**
 * 정산 제출 서류 업로드 — 정산 화면의 "파일 업로드" 버튼.
 *
 * 파일 본문은 받지 않습니다. 화면에서 고른 **파일명만** 기록해 제출 상태를 채웁니다
 * (시연 범위에서 스토리지를 붙이면 용량·권한·수명주기가 따라옵니다).
 * 그래서 응답에도 "무엇이 기록됐는지"를 그대로 돌려줍니다 — 저장한 척하지 않습니다.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

/** POST /api/settlement/documents/{key}  body: { fileName } */
export async function POST(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  const parsed = await readBody(req);
  if (parsed.kind === "invalid") return badJson();
  const body = (parsed.kind === "json" ? parsed.value : {}) as { fileName?: unknown };

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileName) {
    return Response.json({ error: "fileName 이 필요합니다." }, { status: 400 });
  }

  const data = await loadUniverse();
  const doc = data.settlementDocuments.find((d) => d.key === key);
  if (!doc) {
    const known = data.settlementDocuments.map((d) => d.key).join(", ");
    return Response.json(
      { error: `알 수 없는 서류입니다: ${key} (가능한 값: ${known})` },
      { status: 404 },
    );
  }

  const upload = await saveUpload(key, fileName);
  return Response.json({ upload, note: "파일 본문은 저장하지 않습니다 — 제출 상태만 기록합니다." });
}
