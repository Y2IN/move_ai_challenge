import { seed } from "@railhub/be/seed";
import { match } from "@railhub/be/matching";

export const dynamic = "force-dynamic";

export function GET() {
  const r = match(seed, null);
  return Response.json({
    status: r.status,
    members: r.members.map((m) => `${m.shipperName} ${m.weightTon}t`),
    totalTon: r.totalTon,
    capacityTon: r.capacityTon,
    shortfallTon: r.shortfallTon,
  });
}
