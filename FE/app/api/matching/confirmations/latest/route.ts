import { latestConfirmation } from "@railhub/be/store";

/**
 * 가장 최근 확정 편성.
 *
 * 확정 화면에 직접 들어왔거나(세션에 번호가 없거나) 세션이 끊긴 경우,
 * 새로 확정하는 대신 마지막 편성을 보여주기 위한 조회다.
 */
export const dynamic = "force-dynamic";

/** GET /api/matching/confirmations/latest */
export async function GET() {
  const confirmation = await latestConfirmation();
  return Response.json({ exists: confirmation !== null, confirmation });
}
