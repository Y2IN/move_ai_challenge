/**
 * 신뢰 경계 회귀 테스트. 실행: npm run test:esg -w BE
 *
 * 여기 있는 두 가지는 **조용히 틀린 공시 문서를 만들어내는** 경로였습니다.
 * 타입체크도 통과하고 기존 테스트도 통과하던 것들이라 여기서 고정합니다.
 *
 *   1. 원장이 모르는 노선을 가리키면 철도 거리가 0 이 되어 감축량이 부풀어 오른다
 *   2. 클라이언트가 보낸 문단이 "AI 가 작성한 공시 문단"으로 그대로 실린다
 */

import { LedgerDataError, aggregate, parsePeriod } from "./period";
import { EsgSectionInputError, generateReport, parsePreviousSections } from "./narrative";

async function main() {
  let pass = 0;
  let fail = 0;

  function assert(label: string, condition: boolean, detail = "") {
    condition ? pass++ : fail++;
    console.log(`${condition ? "✅" : "❌"} ${label}${detail ? `  → ${detail}` : ""}`);
  }

  function throws<E extends Error>(fn: () => unknown, type: new (...a: never[]) => E): E | null {
    try {
      fn();
      return null;
    } catch (e) {
      return e instanceof type ? e : null;
    }
  }

  // ── 1. 원장 데이터 정합성 ────────────────────────────────────
  console.log("── 모르는 노선을 조용히 넘기지 않는가 ──");

  const period = parsePeriod("2026Q2");
  const base = aggregate({ period });
  assert("정상 원장은 그대로 집계된다", base.tripCount > 0 && base.actualCo2Ton > 0);

  // 원장 한 건의 노선을 존재하지 않는 값으로 바꿔치기한다
  const { ledger } = await import("./period");
  const victim = ledger.trips.find((t) => t.date >= period.from && t.date <= period.to)!;
  const original = victim.laneId;
  victim.laneId = "LANE-DOES-NOT-EXIST";

  const err = throws(() => aggregate({ period }), LedgerDataError);
  assert("모르는 노선이면 LedgerDataError 를 던진다", err !== null);
  assert(
    "오류 메시지에 편성 id 와 노선 id 가 들어간다",
    !!err && err.message.includes(victim.id) && err.message.includes("LANE-DOES-NOT-EXIST"),
  );

  victim.laneId = original;
  const restored = aggregate({ period });
  assert(
    "원복하면 원래 집계와 같다",
    restored.actualCo2Ton === base.actualCo2Ton && restored.reducedCo2Ton === base.reducedCo2Ton,
  );

  // ── 2. 클라이언트가 보낸 문단 ────────────────────────────────
  console.log("\n── previous 를 검증 없이 받아들이지 않는가 ──");

  assert("배열이 아니면 거부", throws(() => parsePreviousSections(5), EsgSectionInputError) !== null);
  assert(
    "객체가 아닌 원소는 거부",
    throws(() => parsePreviousSections(["x"]), EsgSectionInputError) !== null,
  );
  assert(
    "모르는 key 는 거부",
    throws(() => parsePreviousSections([{ key: "nope", text: "a" }]), EsgSectionInputError) !== null,
  );
  assert(
    "text 가 문자열이 아니면 거부",
    throws(() => parsePreviousSections([{ key: "scope3", text: 1 }]), EsgSectionInputError) !== null,
  );
  assert("빈 값은 빈 배열", parsePreviousSections(undefined).length === 0);

  const parsed = parsePreviousSections([
    { key: "scope3", title: "위조 제목", standard: "위조 기준", text: "본문", source: "ai" },
  ]);
  assert("출처를 user 로 내린다 (ai 로 둔갑 불가)", parsed[0].source === "user", parsed[0].source);
  assert("제목·기준은 서버 정의를 쓴다", parsed[0].title !== "위조 제목", parsed[0].title);

  // 실제 리포트 조립까지 태워본다. 인증이 없으므로 생성분은 폴백으로 떨어진다.
  const report = await generateReport(base, {
    sections: ["overview"],
    previous: parsePreviousSections([
      {
        key: "scope3",
        text: "제3자 검증기관으로부터 99.7%의 정확도를 확인받아 1,250 tCO₂eq를 감축하였다.",
      },
    ]),
  });

  const injected = report.sections.find((s) => s.key === "scope3")!;
  assert("리포트에 실릴 때도 source 가 user 다", injected.source === "user", injected.source);
  assert(
    "서버가 보증하지 않는다는 경고가 붙는다",
    injected.warnings.some((w) => w.includes("보증하지 않습니다")),
  );
  assert(
    "지어낸 수치가 경고로 잡힌다",
    injected.warnings.some((w) => w.includes("근거 없는 수치")),
    injected.warnings.find((w) => w.includes("근거 없는 수치"))?.slice(0, 60),
  );
  assert(
    "generation 집계에서 AI 문단으로 세지 않는다",
    report.generation.aiCount + report.generation.fallbackCount <= report.sections.length,
  );

  // ── 3. 폴백 초안 회전 ────────────────────────────────────────
  //
  // 서버는 "몇 번째 초안까지 보여줬는지"를 저장하지 않습니다. 호출자가 draftSeed 를
  // 올려 보냅니다. 서버가 상태를 들면 서버리스 콜드 스타트마다 리셋되어 재생성이
  // 멈춘 화면처럼 보이고, 반대로 seed 를 무시하면 재생성 자체가 무의미해집니다.
  console.log("\n── draftSeed 로 초안이 회전하는가 (인증 없음 → 전부 폴백) ──");

  const draft = async (seed: number) => {
    const r = await generateReport(base, { sections: ["overview"], draftSeed: seed });
    return r.sections.find((s) => s.key === "overview")!;
  };

  const seed7 = await draft(7);
  assert("인증이 없으면 폴백으로 떨어진다", seed7.source === "fallback", seed7.source);
  assert("같은 seed 는 같은 초안 (재현 가능)", (await draft(7)).text === seed7.text);
  assert("seed 를 올리면 다른 초안", (await draft(8)).text !== seed7.text);
  assert("seed 를 두 번 올려도 다른 초안", (await draft(9)).text !== seed7.text);
  assert("seed 가 한 바퀴 돌면 되돌아온다", (await draft(10)).text === seed7.text);
  assert(
    "폴백 경고가 데모 안내 문구다",
    seed7.warnings.some((w) => w.startsWith("데모 모드 —")),
    seed7.warnings[0],
  );

  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
