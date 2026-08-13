/**
 * 시연용 시드 데이터 진입점.
 *
 * 실제 값은 `seed.json` 에 있습니다. 데이터를 고칠 땐 JSON 만 건드리세요.
 * 이 파일은 타입을 입혀서 내보내는 역할만 합니다.
 *
 * FE 는 `import { seed } from "@railhub/be/seed"` 로 씁니다.
 * (`@railhub/be` 의 exports 맵은 `./src/*.ts` 만 노출하므로 JSON 을 직접 import 할 수 없습니다.)
 */

import raw from "./seed.json";
import type { SeedData } from "./types";

/**
 * JSON import 는 문자열 필드를 전부 `string` 으로 넓혀서 읽습니다.
 * (`packaging: "pallet"` → `string`) 리터럴 유니온과 맞지 않으므로 한 번만 단언합니다.
 * seed.json 을 고칠 때 타입이 안 맞으면 여기서 잡히지 않으니 주의하세요.
 */
export const seed = raw as unknown as SeedData;

/** 시연 시작 상태에서 매칭 대기 중인 화물 */
export const requestedShipments = seed.shipments.filter((s) => s.status === "requested");

/** 조율로 당겨올 수 있는 예정 물량 */
export const pullForwardCandidates = seed.shipments.filter(
  (s) => s.status === "scheduled" && s.pullForwardEligible,
);

export default seed;
