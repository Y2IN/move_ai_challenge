import { listWagonTypes } from "@railhub/be/master";

// 화차 종류 (컨테이너/유개/무개/탱크).
export const dynamic = "force-dynamic";

/** GET /api/master/wagon-types */
export function GET() {
  const items = listWagonTypes();
  return Response.json({ items, count: items.length });
}
