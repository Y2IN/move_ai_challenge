/**
 * 계산 없이 리포트를 개발·시연하기 위한 고정 입력.
 *
 * **디자인 06c의 숫자를 베낀 게 아니다.** (그건 예시 데이터라 근거가 없다)
 * `seed.json` 을 실제 계산 엔진(`calc.ts`)에 통과시켜 뽑은 출력을 그대로 굳혔다.
 *
 * 보조금 상한(B)은 한국철도물류협회 **공식 원단위**(2026년 도로 123.09 / 철도 42.25
 * 원/ton·km)로 산정한 절감액 × 30% 다. `benefit.items` 4개 항목 합계(`totalB`)는
 * ESG 대시보드 표시용 추정치라 값이 다르며, 보조금 산정에 쓰면 안 된다.
 *
 * 운임계산톤수는 max(실적재톤수, 정원 × 최저톤수율 80%) 기준이다.
 *
 * ⚠️ `result.eligible === false` 다.
 *    실지불 도로 운임을 baseline 으로 쓰면 철도 합적이 더 싸서 전환 추가비용이
 *    발생하지 않는다. 예외 케이스가 아니라 **기본 케이스**이므로 문단 프롬프트는
 *    이 분기를 먼저 만들어야 한다. (docs/ESG_REPORT_PLAN.md §4.3)
 */

import type { ReportInput } from "./contract";

export const fixtureReportInput: ReportInput = {
  period: {
    from: "2026-04-01",
    to: "2026-06-30",
    label: "2026년 2분기",
  },
  applicant: {
    name: "embark 주식회사",
    bizNo: "111-11-11111",
    ceo: "제예인",
    manager: "최현지",
    phone: "02-6000-1234",
    address: "서울특별시 oorn oo동",
  },
  plan: {
    rows: [
      {
        route: "울산화물역 → 오봉역",
        item: "석유화학제품 · 기타 · 철강재",
        tons: 216,
        trips: 12,
        wagonType: "유개화차",
      },
    ],
    total: {
      itemCount: 3,
      tons: 216,
      trips: 12,
      wagonTypeCount: 1,
    },
    avgLoadRate: 1,
  },
  extraCost: {
    rows: [
      {
        label: "철도수송비",
        formula: "간선 운임 · 복귀 공차 할인 적용",
        amount: 6137892,
      },
      {
        label: "상하역비",
        formula: "216톤 × 양단 상하역",
        amount: 2592000,
      },
      {
        label: "셔틀운송비",
        formula: "공장↔역 양단 도로 운송",
        amount: 1633044,
      },
      {
        label: "도로수송비 (차감)",
        formula: "기존 도로 운송 실적 기준",
        amount: -22380000,
      },
    ],
    totalA: -12017064,
  },
  benefit: {
    items: [
      {
        label: "온실가스 감축",
        basis: "9.5 tCO₂eq",
        source:
          "국토교통부 수송수단별 온실가스 배출원단위 / 국가온실가스 인벤토리",
        amount: 476352,
        key: "ghg",
      },
      {
        label: "대기오염 저감",
        basis: "NOx·SOx·PM2.5",
        source: "한국교통연구원(KOTI) 「교통시설 투자평가지침」",
        amount: 399180,
        key: "airPollution",
      },
      {
        label: "교통사고 예방",
        basis: "대형화물차 주행 감소",
        source: "한국교통연구원(KOTI) 「교통시설 투자평가지침」",
        amount: 773100,
        key: "accident",
      },
      {
        label: "도로혼잡 완화",
        basis: "차량·km 감소분",
        source: "한국교통연구원(KOTI) 「교통시설 투자평가지침」",
        amount: 2038584,
        key: "congestion",
      },
      {
        label: "도로유지비 절감",
        basis: "포장 손상 감소",
        source: "한국교통연구원(KOTI) 「교통시설 투자평가지침」",
        amount: 354144,
        key: "roadWear",
      },
    ],
    totalB: 4041360,
    official: {
      year: 2026,
      roadUnitCost: 123.09,
      railUnitCost: 42.25,
      roadSocialKrw: 10026420,
      railSocialKrw: 4976088,
      savingKrw: 5050332,
    },
    co2ReducedTon: 9.5,
    co2ReductionRate: 0.7305377421374458,
    equivalents: {
      pineTrees: 1440,
      trucksBlocked: 12,
    },
  },
  result: {
    A: -12017064,
    B: 1515100,
    adopted: "none",
    subsidy: 0,
    eligible: false,
    legalBasis:
      "지속가능 교통물류 발전법 제21조 · 국토교통부고시 제2019-16호 「전환교통 협약에 관한 규정」 제17조 · 한국철도물류협회 2026년 전환교통지원사업 공고",
  },
  coefficientVersion: "railhub-2026.2",
};

export default fixtureReportInput;
