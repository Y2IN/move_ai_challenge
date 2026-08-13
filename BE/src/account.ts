/**
 * 로그인 계정 (#4 GET /api/me).
 *
 * 인증(#1~#5)은 MVP 범위 밖이라 세션이 없습니다. 대신 화면이 고른 역할로
 * 시드의 계정을 돌려줍니다 — 화면에 회사명·담당자를 상수로 박지 않기 위한 것입니다.
 * 인증이 붙으면 이 함수만 세션 조회로 갈아 끼우면 됩니다.
 */

import { seed } from "./seed";
import type { Account, Persona, SeedData } from "./types";

export const PERSONAS: Persona[] = ["corp", "korail"];

export function isPersona(value: string): value is Persona {
  return (PERSONAS as string[]).includes(value);
}

/** 시드에 없는 persona 면 null. 라우트가 400 으로 막습니다. */
export function getAccount(persona: Persona, data: SeedData = seed): Account | null {
  return data.accounts[persona] ?? null;
}
