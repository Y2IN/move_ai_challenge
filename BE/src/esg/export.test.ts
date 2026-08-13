/**
 * Scope 3 내보내기(#42) 회귀 테스트. 실행: npm run test:esg -w BE
 *
 * 왜 필요한가: xlsx 는 외부 라이브러리(write-excel-file)에, pdf 는 인쇄 CSS 에 의존합니다.
 * 둘 다 **파일을 열어봐야** 깨진 걸 알 수 있는 종류라, 배포 후 담당자가 발견하면 늦습니다.
 * 여기서 zip 구조와 시트 이름까지 직접 열어 확인합니다.
 */

import { unzipSync, strFromU8 } from "fflate";
import { buildExport, EXPORT_FORMATS, toCsv, toPrintableHtml, toXlsx } from "./scope3";
import { aggregate, parsePeriod } from "./period";

async function main() {
  const agg = aggregate({ period: parsePeriod("2026Q2") });

  let pass = 0;
  let fail = 0;

  function check(label: string, condition: boolean, detail = "") {
    condition ? pass++ : fail++;
    console.log(`${condition ? "✅" : "❌"} ${label}${detail ? `  → ${detail}` : ""}`);
  }

  console.log(`집계: ${agg.period.label} · 편성 ${agg.tripCount}회 · 활동데이터 ${agg.legCount}건\n`);

  // ── CSV ────────────────────────────────────────────────────────
  console.log("── CSV (검증기관 재계산용 원자료) ──");
  const csv = toCsv(agg);
  const csvLines = csv.trimEnd().split("\r\n");
  check("UTF-8 BOM 있음 (없으면 엑셀에서 한글 깨짐)", csv.startsWith("﻿"));
  check("CRLF 줄바꿈", csv.includes("\r\n"));
  check(`행 수 = 활동데이터 건수 + 헤더`, csvLines.length === agg.legCount + 1, `${csvLines.length}행`);
  const headerCols = csvLines[0].split(",").length;
  check(
    "모든 행의 열 수가 헤더와 동일",
    csvLines.every((l) => l.split(",").length === headerCols),
    `${headerCols}열`,
  );
  check("계수 버전이 행마다 박혀 있음", csvLines[1].includes(agg.coefficientVersion));

  // ── XLSX ───────────────────────────────────────────────────────
  console.log("\n── XLSX (실무용 통합문서) ──");
  const buffer = await toXlsx(agg);
  check("PK 시그니처 — 진짜 zip 기반 xlsx", buffer[0] === 0x50 && buffer[1] === 0x4b);
  const entries = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(entries);
  check("[Content_Types].xml 존재", names.includes("[Content_Types].xml"));
  check("workbook.xml 존재", names.includes("xl/workbook.xml"));

  const workbook = strFromU8(entries["xl/workbook.xml"]);
  const sheetNames = [...workbook.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
  check("시트 3개 (요약·명세·계수)", sheetNames.length === 3, sheetNames.join(" / "));
  check("시트명 한글 정상", sheetNames.includes("요약") && sheetNames.includes("적용 계수"));

  const sharedStrings = entries["xl/sharedStrings.xml"]
    ? strFromU8(entries["xl/sharedStrings.xml"])
    : "";
  check("한글 데이터 인코딩 정상", sharedStrings.includes("수송일자") && sharedStrings.includes("누리정공"));
  check("계수표가 함께 들어감 (재계산 가능)", sharedStrings.includes("배출원단위"));

  // ── PDF (인쇄용 HTML) ──────────────────────────────────────────
  console.log("\n── PDF (인쇄용 공시 부속서) ──");
  const html = toPrintableHtml(agg);
  check("A4 인쇄 설정", html.includes("@page { size: A4"));
  check("표 헤더 페이지마다 반복", html.includes("table-header-group"));
  check("행이 페이지 경계에서 안 잘림", html.includes("break-inside: avoid"));
  check(
    "K-ESG 지표 3종 모두 포함",
    ["E-3-2", "E-7-1", "E-3-3"].every((c) => html.includes(c)),
  );
  check("고정 문구 포함", html.includes("AI는 서술 문장만 작성합니다"));
  check("제3자 검증 미실시 명시", html.includes("제3자 검증기관의 검증을 받지 않았습니다"));
  check(
    "미검증 계수 배지",
    agg.verified ? !html.includes("미검증 계수 포함") : html.includes("미검증 계수 포함"),
  );
  check("autoprint 기본 꺼짐", !html.includes("window.addEventListener('load'"));
  check("autoprint=1 이면 켜짐", toPrintableHtml(agg, true).includes("window.addEventListener('load'"));

  // ── 라우트 계약 ────────────────────────────────────────────────
  console.log("\n── 라우트 계약 ──");
  for (const format of EXPORT_FORMATS) {
    const file = await buildExport(agg, format);
    const okName = file.filename.endsWith(`.${format === "pdf" ? "html" : format}`);
    check(
      `${format}: 파일명·content-type·inline 플래그`,
      okName && file.contentType.length > 0 && file.inline === (format === "pdf"),
      `${file.filename} · inline=${file.inline}`,
    );
  }

  console.log(`\n통과 ${pass} · 실패 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
