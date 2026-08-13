import { fixtureReportInput as fx } from "./fixture";
import { collectAllowedNumbers, findHallucinatedNumbers } from "./verify";

const allowed = collectAllowedNumbers(fx);

/** fixture 값이 바뀌어도 테스트가 깨지지 않도록 문장을 데이터에서 만든다. */
const n = (v: number) => v.toLocaleString("ko-KR");
const co2 = fx.benefit.co2ReducedTon;
const rate = Math.round(fx.benefit.co2ReductionRate * 100);
const totalB = n(fx.benefit.totalB);
const tons = n(fx.plan.total.tons);
const trips = fx.plan.total.trips;
const roadCost = n(Math.abs(fx.extraCost.rows[3].amount));
const totalA = n(Math.abs(fx.extraCost.totalA));
const trees = n(fx.benefit.equivalents.pineTrees);
let pass = 0, fail = 0;

function check(label: string, text: string, shouldBeClean: boolean) {
  const r = findHallucinatedNumbers(text, allowed);
  const ok = r.clean === shouldBeClean;
  ok ? pass++ : fail++;
  const mark = ok ? "✅" : "❌";
  const want = shouldBeClean ? "통과해야" : "잡혀야";
  console.log(`${mark} [${want} 함] ${label}`);
  if (!ok) console.log(`     → ${r.message}`);
  else if (!shouldBeClean) console.log(`     → 잡힘: ${r.offenders.join(", ")}`);
}

console.log(`allowed 집합 크기: ${allowed.size}\n`);
console.log("── 정상 문장 (오탐 나면 안 됨) ──");

check("기간 라벨 인용", "당사는 2026년 2분기 중 철도 전환을 추진하였습니다.", true);
check("총 물량·횟수", `총 ${tons}톤을 ${trips}회에 걸쳐 수송하였습니다.`, true);
check("탄소 감축량", `보고 기간 내 ${co2} tCO₂eq 를 감축하였습니다.`, true);
check("감축률 퍼센트", `도로 단독 대비 ${rate}% 수준의 배출 저감에 해당합니다.`, true);
check("편익 금액 원본", `사회환경적 편익은 총 ${totalB}원으로 산출되었습니다.`, true);
check("적재율 100%", "전 구간 평균 적재율 100%를 확보하였습니다.", true);
check("근거 조문", `${fx.result.legalBasis}에 근거합니다.`, true);
check("계수 버전", `계수 버전 ${fx.coefficientVersion} 을 적용하였습니다.`, true);
check("소나무 환산", `소나무 ${trees}그루를 심은 것과 같습니다.`, true);
check("음수 금액 부호 없이", `도로수송비 ${roadCost}원을 차감하였습니다.`, true);
check("추가비용 절대값", `전환 추가비용은 ${totalA}원 규모로 산출되었습니다.`, true);
check("한 자리 수 서수", "3개 품목을 대상으로 하였습니다.", true);
check("숫자 없는 문장", "당사는 향후 철도 분담률을 지속적으로 높여 나가고자 합니다.", true);

console.log("\n── 환각 문장 (반드시 잡혀야 함) ──");

check("없는 감축량", "보고 기간 내 182 tCO₂eq 를 감축하였습니다.", false);
check("없는 금액", "사회환경적 편익은 총 1,140,000,000원입니다.", false);
check("없는 퍼센트", "도로 대비 74% 저감에 해당합니다.", false);
check("없는 트럭 대수", "대형 트럭 45대의 도심 진입을 막았습니다.", false);
check("없는 보조금액", "보조금 342,000,000원을 신청합니다.", false);
check("없는 톤수", "총 4,280톤을 수송하였습니다.", false);
check("그럴듯한 오차", "9.7 tCO₂eq 를 감축하였습니다.", false);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
if (fail > 0) process.exitCode = 1;
