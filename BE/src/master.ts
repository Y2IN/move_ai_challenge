/**
 * 마스터 데이터 노출 — 역(자연어 파싱 정규화용) · 화차 종류.
 * 시드 데이터를 표시용으로 얇게 가공해 돌려준다.
 */

import { seed } from "./seed";
import type { SeedData, WagonType } from "./types";

/** 역 마스터 (GET /api/master/stations) */
export function listStations(data: SeedData = seed) {
  return data.stations.map((s) => ({
    id: s.id,
    name: s.name,
    region: s.region,
    handling: s.handling,
  }));
}

const WAGON_TYPE_LABEL: Record<WagonType, string> = {
  covered: "유개화차",
  open: "무개화차",
  container: "컨테이너화차",
  tank: "탱크화차",
};

/** 화차 종류 (GET /api/master/wagon-types) */
export function listWagonTypes() {
  return (Object.keys(WAGON_TYPE_LABEL) as WagonType[]).map((code) => ({
    code,
    label: WAGON_TYPE_LABEL[code],
  }));
}
