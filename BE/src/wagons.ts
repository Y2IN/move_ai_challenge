/**
 * 코레일 공차(빈 화차) 조회 — 시드의 emptyWagons 를 화면 표시용으로 가공합니다.
 *
 * 라우트(FE/app/api/wagons/vacancies)는 얇게 두고, 역명·노선 해석 같은
 * 도메인 로직은 여기서 처리합니다. types.ts 는 건드리지 않고 표시용 타입을
 * 이 파일에서 내보냅니다.
 *
 * ⚠️ 현재는 시드 3량(단일 노선) 고정입니다. 실제 코레일 연동 시 이 모듈의
 *    데이터 소스만 바꾸면 됩니다.
 */

import { seed } from "./seed";
import type { EmptyWagon, SeedData, WagonType } from "./types";

export interface VacancyStop {
  stationId: string;
  stationName: string;
  date: string;
  dayOfWeek: string;
  time: string;
}

export interface VacancyItem {
  id: string;
  label: string;
  wagonType: WagonType;
  capacityTon: number;
  capacityCbm: number;
  laneId: string;
  /** 표시용 노선 (예: "울산화물역 → 오봉역") */
  route: string;
  departure: VacancyStop;
  arrival: VacancyStop;
  /** 잔여 적재 가능 톤. 시드 공차는 전부 비어 있으므로 정원과 같다 (향후 확정분 차감 지점). */
  remainingTon: number;
  emptyReason: string;
  handling: string[];
}

/** 공차 목록을 표시용으로 반환. `laneId` 를 주면 해당 노선만 필터합니다. */
export function listVacancies(data: SeedData = seed, laneId?: string): VacancyItem[] {
  const nameOf = (stationId: string) =>
    data.stations.find((s) => s.id === stationId)?.name ?? stationId;
  const wagons = laneId
    ? data.emptyWagons.filter((w) => w.laneId === laneId)
    : data.emptyWagons;
  return wagons.map((w) => toVacancy(w, nameOf));
}

function toVacancy(w: EmptyWagon, nameOf: (id: string) => string): VacancyItem {
  const depName = nameOf(w.departure.stationId);
  const arrName = nameOf(w.arrival.stationId);
  return {
    id: w.id,
    label: w.label,
    wagonType: w.wagonType,
    capacityTon: w.capacityTon,
    capacityCbm: w.capacityCbm,
    laneId: w.laneId,
    route: `${depName} → ${arrName}`,
    departure: { ...w.departure, stationName: depName },
    arrival: { ...w.arrival, stationName: arrName },
    remainingTon: w.capacityTon,
    emptyReason: w.emptyReason,
    handling: w.handling,
  };
}
