import { findLatest } from "@railhub/be/report/store";

/**
 * api_list #34 — 최근 초안 조회.
 *
 * 사이드바에서 "보조금 · ESG 리포트"로 재진입했을 때 초안이 있으면
 * 06a(생성 전)가 아니라 06c(생성 완료)로 바로 들어가기 위한 것.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const app = findLatest();
  if (!app) return Response.json({ exists: false, applicationId: null });

  return Response.json({
    exists: true,
    applicationId: app.id,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    paragraphCount: app.document.meta.paragraphCount,
    revisionCount: app.revisions.length,
    eligible: app.document.meta.eligible,
  });
}
