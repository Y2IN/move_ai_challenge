/**
 * 시연 날짜 롤링 — 시드의 매칭 시나리오 날짜를 "오늘 기준"으로 밀어준다.
 *
 * ## 왜 필요한가
 *
 * seed.json 의 화차 마감·출발일은 절대 날짜다. 작성 시점에는 맞았지만 며칠만
 * 지나면 전부 과거가 되어 데모가 뒤집힌다 — 마감 전 "정원 미달"이어야 할 편성이
 * 마감 후 규칙(minLoadRate)으로 "확정"이 되고, 등록 폼의 어떤 날짜를 골라도
 * noWagon 이 나온다. 실제로 그렇게 한 번 썩었다 (cutoff 가 −114시간).
 *
 * ## 어떻게 미는가
 *
 * seed.json 의 `meta.dateAnchor`(D0)와 오늘의 차이만큼 **모든 시나리오 날짜를
 * 통째로 시프트**한다. 상대 배치가 보존되므로 매칭·조율 시나리오가 그대로 산다:
 *
 *   화차 cutoff  D+1 18:00  → 언제 로드해도 마감까지 18~42시간
 *                              = 조율 윈도우(48h) 안 → **조율 데모 상시 성립**
 *   화차 출발    D+2 / D+6   → 등록 폼 기본값(±2일)으로 대부분 매칭 도달
 *
 * 시프트 후 화차 출발일이 **일요일**이면 하루 미룬다 (코레일 화물 간선은 일요일
 * 휴무 — 원장 생성기의 영업일 규칙과 같다). 화물 희망일은 밀지 않는다: 유연폭
 * (±2~3일)이 하루 차이를 흡수하도록 시드 배치에 여유를 뒀다.
 *
 * ## 밀지 않는 것
 *
 * 원장(ledger.json)·협약·화주 계약 기간은 **과거 실적/약정 사실**이라 달력에
 * 고정이다. 여기서 건드리면 정산·ESG 집계가 실제 계산과 어긋난다.
 *
 * 순수 함수다 — 입력을 변경하지 않고 복사본을 돌려준다. DB 유니버스 로더와
 * 번들 seed 폴백이 같은 함수를 거치므로 어느 경로든 날짜가 같다.
 */

import type { EmptyWagon, SeedData, Shipment } from "./types";

const DAY_MS = 86_400_000;
const DOW = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 로컬 달력 기준 YYYY-MM-DD (UTC 변환 금지 — KST 자정 직후 어제로 밀린다) */
export function todayYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftYmd(ymd: string, days: number): string {
  const t = new Date(`${ymd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** "2026-08-25T18:00:00+09:00" 처럼 날짜 뒤에 시각·오프셋이 붙은 값 — 날짜만 민다 */
function shiftIso(iso: string, days: number): string {
  return shiftYmd(iso.slice(0, 10), days) + iso.slice(10);
}

function dayOfWeek(ymd: string): string {
  return DOW[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
}

function isSunday(ymd: string): boolean {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay() === 0;
}

function rollWagon(w: EmptyWagon, delta: number): EmptyWagon {
  let dep = shiftYmd(w.departure.date, delta);
  let arr = shiftYmd(w.arrival.date, delta);
  if (isSunday(dep)) {
    dep = shiftYmd(dep, 1);
    arr = shiftYmd(arr, 1);
  }
  return {
    ...w,
    cutoffAt: shiftIso(w.cutoffAt, delta),
    departure: { ...w.departure, date: dep, dayOfWeek: dayOfWeek(dep) },
    arrival: { ...w.arrival, date: arr, dayOfWeek: dayOfWeek(arr) },
  };
}

function rollShipment(s: Shipment, delta: number): Shipment {
  return {
    ...s,
    schedule: {
      ...s.schedule,
      requestedDepartureDate: shiftYmd(s.schedule.requestedDepartureDate, delta),
      requiredArrivalBy: s.schedule.requiredArrivalBy
        ? shiftYmd(s.schedule.requiredArrivalBy, delta)
        : s.schedule.requiredArrivalBy,
    },
    fallbackHints: {
      ...s.fallbackHints,
      hardArrivalBy: s.fallbackHints.hardArrivalBy
        ? shiftYmd(s.fallbackHints.hardArrivalBy, delta)
        : s.fallbackHints.hardArrivalBy,
    },
  };
}

/**
 * 시나리오 날짜를 오늘 기준으로 민 복사본을 돌려준다.
 * `meta.dateAnchor` 가 없으면 그대로 돌려준다 (롤링 미적용 데이터 보호).
 * 결과의 dateAnchor 는 오늘로 갱신된다 — 두 번 적용해도 같은 결과(멱등).
 */
export function rollDemoDates(data: SeedData, today: Date = new Date()): SeedData {
  const anchor = data.meta?.dateAnchor;
  if (typeof anchor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return data;

  const target = todayYmd(today);
  const delta = Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / DAY_MS,
  );
  // delta 0 이어도 일요일 보정은 필요할 수 있으므로 항상 재계산한다.

  return {
    ...data,
    meta: { ...data.meta, dateAnchor: target },
    emptyWagons: data.emptyWagons.map((w) => rollWagon(w, delta)),
    shipments: data.shipments.map((s) => rollShipment(s, delta)),
  };
}
