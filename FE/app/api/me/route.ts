import { getAccount, isPersona, PERSONAS } from "@railhub/be/account";

/**
 * api_list #4 — 세션 확인 (사이드바 "embark · 최현지" 렌더).
 *
 * 인증(#1~#5)이 MVP 밖이라 세션 대신 화면이 고른 역할을 받습니다. 그래도
 * 계정 표시값은 서버가 줘야 합니다 — 화면에 회사명·담당자를 상수로 박아 두면
 * 인증이 붙는 날 그 상수를 찾아 지우는 일부터 해야 합니다.
 */
export const dynamic = "force-dynamic";

/** GET /api/me?persona=corp|korail */
export function GET(req: Request) {
  const persona = new URL(req.url).searchParams.get("persona") ?? "corp";
  if (!isPersona(persona)) {
    return Response.json(
      { error: `persona 는 ${PERSONAS.join(" | ")} 중 하나여야 합니다: ${persona}` },
      { status: 400 },
    );
  }

  const account = getAccount(persona);
  if (!account) {
    return Response.json({ error: `계정을 찾을 수 없습니다: ${persona}` }, { status: 404 });
  }
  return Response.json({ account, authenticated: false });
}
