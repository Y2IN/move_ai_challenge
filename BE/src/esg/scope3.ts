/**
 * Scope 3 데이터 내보내기 (api_list #42).
 *
 * 공시 담당자가 검증기관에 넘기는 **원자료**입니다. 요약이 아니라 건별 명세여야
 * 하고, 계수와 산식이 같이 들어가야 검증기관이 재계산할 수 있습니다.
 *
 * ## 형식 3종을 왜 이렇게 나눴는가
 *
 * | 형식 | 용도 | 구성 |
 * | --- | --- | --- |
 * | `csv`  | 검증기관·회계법인이 재계산에 쓰는 기계 판독용 원자료 | 명세 1장 |
 * | `xlsx` | 담당자가 열어서 보고 편집하는 실무 파일 | 요약·명세·계수 3시트 |
 * | `pdf`  | 보고서에 붙이는 공시 부속서 (인쇄용) | 지표표·요약·명세·계수 |
 *
 * ## xlsx — write-excel-file 을 쓰는 이유
 * 처음엔 의존성을 늘리지 않으려고 SpreadsheetML(.xls, XML) 로 냈지만, 확장자와
 * 실제 형식이 달라 담당자가 받는 파일이 어정쩡해집니다. 라이브러리를 쓰기로 하고
 * 아래 기준으로 골랐습니다.
 *
 *   - `write-excel-file` (MIT · 의존성 fflate 1개 · 취약점 0건) ← **채택**
 *   - `exceljs` (MIT) 는 취약점이 보고된 `uuid` 를 포함하고 트리가 훨씬 큽니다.
 *     서버리스 번들에 그대로 얹히므로 콜드스타트에 불리합니다.
 *   - SheetJS(`xlsx`) 커뮤니티판은 npm 배포본이 오래됐고 최신은 유료 채널입니다.
 *
 * ## pdf — 라이브러리를 안 쓰는 이유
 * PDF 생성기(puppeteer·pdfkit)는 서버리스에서 바이너리·폰트가 문제가 됩니다.
 * 특히 **한글 폰트 임베딩**이 걸리는데, 브라우저 인쇄는 OS 폰트를 그대로 쓰므로
 * 이 문제가 통째로 사라집니다. 인쇄용 HTML 을 내보내고 브라우저 인쇄(Ctrl+P →
 * PDF로 저장)로 뽑습니다. 표 위주 문서라 인쇄 CSS 로 충분히 재현됩니다.
 */

import writeXlsxFile from "write-excel-file/node";
import {
  AIR_POLLUTANT_G_PER_TON_KM,
  CARBON_PRICE_IN_USE,
  CO2_G_PER_TON_KM,
  SOCIAL_COST_KRW_PER_TON_KM,
  SOURCES,
} from "../constants";
import { buildIndicators } from "./indicators";
import type { EsgAggregate } from "./types";

export type ExportFormat = "csv" | "xlsx" | "pdf";

const FORMATS: ExportFormat[] = ["csv", "xlsx", "pdf"];

export function isExportFormat(value: string): value is ExportFormat {
  return (FORMATS as string[]).includes(value);
}

export const EXPORT_FORMATS = FORMATS;

const HEADERS = [
  "수송일자",
  "편성ID",
  "화물ID",
  "화주ID",
  "화주명",
  "품목",
  "노선",
  "화차ID",
  "화차종류",
  "중량(톤)",
  "도로직행거리(km)",
  "철도간선거리(km)",
  "셔틀거리(km)",
  "도로 ton·km(기준선)",
  "철도 ton·km",
  "셔틀 ton·km",
  "기준선 배출량(tCO2eq)",
  "실제 배출량(tCO2eq)",
  "감축량(tCO2eq)",
  "감축률",
  "NOx 감축(kg)",
  "SOx 감축(kg)",
  "PM2.5 감축(kg)",
  "사회환경적 편익(원)",
  "계수버전",
] as const;

/** 숫자로 넣어야 엑셀에서 합계·필터가 먹습니다. 문자열로 넣으면 서식만 숫자처럼 보입니다. */
const NUMERIC_COLUMNS = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

function toCells(agg: EsgAggregate): (string | number)[][] {
  return agg.rows.map((r) => [
    r.date,
    r.tripId,
    r.lotId,
    r.shipperId,
    r.shipperName,
    r.category,
    r.route,
    r.wagonId,
    r.wagonType,
    r.weightTon,
    r.roadDirectKm,
    r.railKm,
    r.shuttleKm,
    r.roadTonKm,
    r.railTonKm,
    r.shuttleTonKm,
    r.baselineCo2Ton,
    r.actualCo2Ton,
    r.reducedCo2Ton,
    r.reductionRate,
    r.noxReducedKg,
    r.soxReducedKg,
    r.pm25ReducedKg,
    r.benefitKrw,
    r.coefficientVersion,
  ]);
}

/** 검증기관이 재계산할 수 있도록 같이 내보내는 계수표 */
function coefficientRows(): [string, string, string][] {
  return [
    ["온실가스 배출원단위 · 도로", `${CO2_G_PER_TON_KM.road} g-CO₂eq/ton·km`, SOURCES.co2],
    ["온실가스 배출원단위 · 철도", `${CO2_G_PER_TON_KM.rail} g-CO₂eq/ton·km`, SOURCES.co2],
    ["NOx · 도로", `${AIR_POLLUTANT_G_PER_TON_KM.nox.road} g/ton·km`, SOURCES.airPollutant],
    ["NOx · 철도", `${AIR_POLLUTANT_G_PER_TON_KM.nox.rail} g/ton·km`, SOURCES.airPollutant],
    ["SOx · 도로", `${AIR_POLLUTANT_G_PER_TON_KM.sox.road} g/ton·km`, SOURCES.airPollutant],
    ["SOx · 철도", `${AIR_POLLUTANT_G_PER_TON_KM.sox.rail} g/ton·km`, SOURCES.airPollutant],
    ["PM2.5 · 도로", `${AIR_POLLUTANT_G_PER_TON_KM.pm25.road} g/ton·km`, SOURCES.airPollutant],
    ["PM2.5 · 철도", `${AIR_POLLUTANT_G_PER_TON_KM.pm25.rail} g/ton·km`, SOURCES.airPollutant],
    ["탄소 금전환산 단가", `${CARBON_PRICE_IN_USE.toLocaleString("ko-KR")} 원/tCO₂eq`, SOURCES.kau],
    [
      "대기오염 사회적비용 · 도로",
      `${SOCIAL_COST_KRW_PER_TON_KM.airPollution.road} 원/ton·km`,
      SOURCES.socialCost,
    ],
    [
      "교통사고 사회적비용 · 도로",
      `${SOCIAL_COST_KRW_PER_TON_KM.accident.road} 원/ton·km`,
      SOURCES.socialCost,
    ],
    [
      "도로혼잡 사회적비용 · 도로",
      `${SOCIAL_COST_KRW_PER_TON_KM.congestion.road} 원/ton·km`,
      SOURCES.socialCost,
    ],
    [
      "도로유지 사회적비용 · 도로",
      `${SOCIAL_COST_KRW_PER_TON_KM.roadWear.road} 원/ton·km`,
      SOURCES.socialCost,
    ],
  ];
}

function summaryRows(agg: EsgAggregate): [string, string][] {
  return [
    ["집계 기간", `${agg.period.label} (${agg.period.from} ~ ${agg.period.to})`],
    ["집계 대상", agg.shipperName ?? "전체 화주"],
    ["편성 수", `${agg.tripCount} 회`],
    ["활동데이터 건수", `${agg.legCount} 건`],
    ["참여 화주 수", `${agg.shipperCount} 곳`],
    ["총 수송량", `${agg.totalTon} 톤`],
    ["평균 적재율", `${(agg.avgLoadRate * 100).toFixed(1)}%`],
    ["기준선 배출량", `${agg.baselineCo2Ton} tCO₂eq`],
    ["실제 배출량", `${agg.actualCo2Ton} tCO₂eq`],
    ["감축량", `${agg.reducedCo2Ton} tCO₂eq`],
    ["감축률", `${(agg.reductionRate * 100).toFixed(1)}%`],
    ...agg.pollutants.map((p) => [`${p.label} 감축량`, `${p.reducedKg} kg`] as [string, string]),
    ...agg.benefitItems.map(
      (b) => [`편익 · ${b.label}`, `${b.amountKrw.toLocaleString("ko-KR")} 원`] as [string, string],
    ),
    ["편익 합계", `${agg.totalBenefitKrw.toLocaleString("ko-KR")} 원`],
    ["소나무 환산", `${agg.pineTrees.toLocaleString("ko-KR")} 그루/년`],
    ["대형트럭 환산", `${agg.truckLoadsAvoided.toLocaleString("ko-KR")} 대분`],
    ["계수 버전", agg.coefficientVersion],
    ["계수 검증", agg.verified ? "1차 출처 확인" : "미검증 (추정치 포함)"],
    ["제3자 검증", "미실시 — 내부 산정치"],
  ];
}

// ── CSV ────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * UTF-8 BOM 을 붙입니다. 없으면 엑셀이 한글 헤더를 깨뜨립니다.
 * (BOM 없는 CSV 를 엑셀로 열면 "수송일자"가 "ìˆ˜ì†¡ì¼ìž" 로 보입니다)
 */
export function toCsv(agg: EsgAggregate): string {
  const lines = [HEADERS.join(","), ...toCells(agg).map((row) => row.map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ── XLSX ───────────────────────────────────────────────────────

type XlsxCell = { value?: string | number; type?: StringConstructor | NumberConstructor } & Record<
  string,
  unknown
>;

const headerCell = (value: string): XlsxCell => ({
  value,
  type: String,
  fontWeight: "bold",
  backgroundColor: "#E8EEF7",
  align: "center",
  wrap: true,
});

const textCell = (value: string): XlsxCell => ({ value, type: String });
const numberCell = (value: number): XlsxCell => ({ value, type: Number });

function autoCell(value: string | number, columnIndex: number): XlsxCell {
  return typeof value === "number" && NUMERIC_COLUMNS.has(columnIndex)
    ? numberCell(value)
    : textCell(String(value));
}

export async function toXlsx(agg: EsgAggregate): Promise<Buffer> {
  const detail = [
    HEADERS.map(headerCell),
    ...toCells(agg).map((row) => row.map(autoCell)),
  ];

  const summary = [
    [headerCell("항목"), headerCell("값")],
    ...summaryRows(agg).map(([k, v]) => [textCell(k), textCell(v)]),
  ];

  const coefficients = [
    [headerCell("계수"), headerCell("값"), headerCell("출처")],
    ...coefficientRows().map((row) => row.map(textCell)),
  ];

  return writeXlsxFile(
    [
      { data: summary, sheet: "요약", columns: [{ width: 28 }, { width: 46 }] },
      {
        data: detail,
        sheet: "Scope3 명세",
        // 헤더 고정 — 23행짜리 표를 스크롤할 때 열 이름이 사라지면 검증이 안 됩니다.
        stickyRowsCount: 1,
        columns: HEADERS.map((h) => ({ width: Math.max(12, Math.min(h.length * 2.2, 30)) })),
      },
      { data: coefficients, sheet: "적용 계수", columns: [{ width: 30 }, { width: 26 }, { width: 52 }] },
    ],
    { fontFamily: "맑은 고딕", fontSize: 10 },
  ).toBuffer();
}

// ── PDF (인쇄용 HTML) ──────────────────────────────────────────

const htmlEscape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const td = (v: string | number, cls = "") =>
  `<td${cls ? ` class="${cls}"` : ""}>${htmlEscape(String(v))}</td>`;

/**
 * 인쇄용 부속서 HTML.
 *
 * 인쇄 CSS 의 핵심 3가지:
 *   `@page size: A4`        — 미리보기 여백이 브라우저 기본값(레터)으로 잡히는 것 방지
 *   `thead { table-header-group }` — 표가 여러 장으로 넘어가도 열 이름이 매 장 반복
 *   `tr { break-inside: avoid }`   — 한 행이 페이지 경계에서 잘리는 것 방지
 */
export function toPrintableHtml(agg: EsgAggregate, autoPrint = false): string {
  const indicators = buildIndicators(agg);
  const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

  const indicatorBlocks = indicators
    .map(
      (ind) => `
    <section class="indicator">
      <h3><span class="code">${htmlEscape(ind.code)}</span> ${htmlEscape(ind.name)}</h3>
      <p class="frameworks">${ind.frameworks.map(htmlEscape).join(" · ")}</p>
      <p class="headline">${htmlEscape(ind.headline)} <span>${htmlEscape(ind.headlineUnit)}</span></p>
      <table class="kv">
        <tbody>
          ${ind.metrics
            .map(
              (m) =>
                `<tr class="${m.supplementary ? "sub" : ""}">${td(m.label)}<td class="num">${htmlEscape(
                  m.value,
                )} ${htmlEscape(m.unit)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p class="basis">${htmlEscape(ind.basis)}</p>
      <p class="source">출처: ${htmlEscape(ind.source)}${ind.verified ? "" : " · ⚠ 미검증 계수 포함"}</p>
    </section>`,
    )
    .join("");

  const detailRows = toCells(agg)
    .map(
      (row) =>
        `<tr>${row
          .map((v, i) => td(typeof v === "number" ? v.toLocaleString("ko-KR") : v, NUMERIC_COLUMNS.has(i) ? "num" : ""))
          .join("")}</tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Scope 3 공시 부속서 — ${htmlEscape(agg.period.label)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Pretendard", "Apple SD Gothic Neo", "맑은 고딕", "Malgun Gothic", sans-serif;
    font-size: 10pt; line-height: 1.55; color: #1a1a1a; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1 { font-size: 17pt; margin: 0 0 2mm; }
  h2 { font-size: 12pt; margin: 8mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5pt solid #1a1a1a; }
  h3 { font-size: 10.5pt; margin: 0 0 1mm; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th, td { border: 0.5pt solid #b9c2cf; padding: 1.2mm 1.8mm; text-align: left; vertical-align: top; }
  th { background: #e8eef7; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .meta { color: #555; font-size: 9pt; margin: 0; }
  .badge {
    display: inline-block; border: 0.5pt solid #b45309; color: #b45309;
    border-radius: 2mm; padding: 0.3mm 1.6mm; font-size: 8pt; margin-left: 2mm;
  }
  .indicator { break-inside: avoid; page-break-inside: avoid; margin-bottom: 5mm; }
  .indicator .code { display: inline-block; background: #1a1a1a; color: #fff; padding: 0.3mm 1.6mm; border-radius: 1mm; font-size: 8.5pt; }
  .frameworks { color: #555; font-size: 8.5pt; margin: 0 0 1.5mm; }
  .headline { font-size: 15pt; font-weight: 700; margin: 0 0 2mm; }
  .headline span { font-size: 9.5pt; font-weight: 400; color: #555; }
  table.kv td:first-child { width: 62%; }
  table.kv tr.sub td { color: #666; background: #fafbfd; }
  .basis, .source { font-size: 8.5pt; color: #444; margin: 1.5mm 0 0; }
  .source { color: #777; }
  table.detail { font-size: 7pt; }
  table.detail th, table.detail td { padding: 0.7mm 1mm; }
  .disclaimer {
    margin-top: 6mm; padding: 2.5mm; border: 0.5pt solid #1a1a1a; background: #f6f7f9;
    font-size: 9pt; font-weight: 600; text-align: center;
  }
  .foot { margin-top: 3mm; font-size: 8pt; color: #777; }
  .print-bar { padding: 3mm; background: #1a1a1a; color: #fff; text-align: center; }
  .print-bar button { font: inherit; padding: 1.5mm 4mm; cursor: pointer; border: 0; border-radius: 1mm; }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
<div class="print-bar">
  이 문서는 인쇄용입니다 — <button onclick="window.print()">인쇄 / PDF로 저장</button>
</div>

<h1>Scope 3 공시 부속서</h1>
<p class="meta">
  ${htmlEscape(agg.period.label)} (${agg.period.from} ~ ${agg.period.to})
  · 대상: ${htmlEscape(agg.shipperName ?? "전체 화주")}
  · 계수 버전: ${htmlEscape(agg.coefficientVersion)}
  ${agg.verified ? "" : '<span class="badge">미검증 계수 포함</span>'}
</p>

<h2>1. K-ESG 지표</h2>
${indicatorBlocks}

<h2>2. 기간 집계 요약</h2>
<table class="kv">
  <tbody>
    ${summaryRows(agg)
      .map(([k, v]) => `<tr>${td(k)}${td(v, "num")}</tr>`)
      .join("")}
  </tbody>
</table>

<h2>3. Scope 3 활동데이터 명세 (${agg.legCount}건)</h2>
<table class="detail">
  <thead><tr>${HEADERS.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}</tr></thead>
  <tbody>${detailRows}</tbody>
</table>

<h2>4. 적용 계수</h2>
<table>
  <thead><tr><th>계수</th><th>값</th><th>출처</th></tr></thead>
  <tbody>
    ${coefficientRows()
      .map((row) => `<tr>${row.map((c) => td(c)).join("")}</tr>`)
      .join("")}
  </tbody>
</table>

<p class="disclaimer">수치는 법정 산식과 고정 계수로 계산되며, AI는 서술 문장만 작성합니다.</p>
<p class="foot">
  본 배출량은 내부 산정치이며 제3자 검증기관의 검증을 받지 않았습니다.
  표시 값은 항목별로 반올림한 것으로 표시 값 간 가감이 마지막 자리에서 일치하지 않을 수 있으며,
  검증용 원자료는 CSV 내보내기로 제공됩니다.
</p>
${autoPrint ? "<script>window.addEventListener('load', () => window.print());</script>" : ""}
</body>
</html>`;
}

// ── 파일 메타 ──────────────────────────────────────────────────

export interface ExportFile {
  body: string | Buffer;
  filename: string;
  contentType: string;
  /** PDF(인쇄용 HTML)는 브라우저가 열어야 하므로 다운로드로 던지지 않습니다. */
  inline: boolean;
}

export async function buildExport(
  agg: EsgAggregate,
  format: ExportFormat,
  options: { autoPrint?: boolean } = {},
): Promise<ExportFile> {
  const scope = agg.shipperId ? `-${agg.shipperId}` : "";
  const base = `scope3-${agg.period.id}${scope}`;

  if (format === "csv") {
    return {
      body: toCsv(agg),
      filename: `${base}.csv`,
      contentType: "text/csv; charset=utf-8",
      inline: false,
    };
  }

  if (format === "xlsx") {
    return {
      body: await toXlsx(agg),
      filename: `${base}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      inline: false,
    };
  }

  return {
    body: toPrintableHtml(agg, options.autoPrint ?? false),
    filename: `${base}.html`,
    contentType: "text/html; charset=utf-8",
    inline: true,
  };
}
