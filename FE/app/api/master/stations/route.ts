import { loadUniverse } from "@railhub/be/db/universe";
import { listStations } from "@railhub/be/master";

// 역 마스터 (자연어 파싱 결과 정규화용).
export const dynamic = "force-dynamic";

/** GET /api/master/stations */
export async function GET() {
  const items = listStations(await loadUniverse());
  return Response.json({ items, count: items.length });
}
