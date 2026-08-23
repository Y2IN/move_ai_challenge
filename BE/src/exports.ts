/**
 * 화면에서 내려받는 표 — 정산 보고서 · 화주 영업 리스트 · 수송 실적 리포트.
 *
 * 세 화면에 "생성/발행/내보내기" 버튼이 있었지만 눌러도 아무 일도 일어나지
 * 않았습니다. 여기서 실제 파일을 만듭니다.
 *
 * ## 왜 새 산식을 안 쓰는가
 *
 * 전부 이미 계산된 응답(`getSettlement` · `getClients` · `getHistory`)을 표로
 * 옮기기만 합니다. 여기서 다시 계산하면 화면 숫자와 파일 숫자가 갈라집니다 —
 * 그건 심사에서 가장 먼저 찔리는 종류의 불일치입니다.
 *
 * 파일 계약(`ExportFile`)은 Scope 3 내보내기(esg/scope3.ts)와 같습니다.
 * CSV 는 BOM 을 붙입니다(엑셀이 UTF-8 을 깨뜨리지 않게), PDF 는 인쇄용 HTML 입니다.
 */

import writeXlsxFile from "write-excel-file/node";
import type { ClientsResponse } from "./clients";
import type { HistoryResponse } from "./history";
import type { SettlementResponse } from "./settlement";

export type SheetFormat = "csv" | "xlsx" | "pdf";
export const SHEET_FORMATS: readonly SheetFormat[] = ["csv", "xlsx", "pdf"];

export function isSheetFormat(v: string | null): v is SheetFormat {
  return v !== null && (SHEET_FORMATS as readonly string[]).includes(v);
}

export interface ExportFile {
  body: string | Buffer;
  filename: string;
  contentType: string;
  /** 인쇄용 HTML 은 브라우저가 열어야 하므로 다운로드로 던지지 않습니다. */
  inline: boolean;
}

/** 표 하나 = 제목 + 헤더 + 행. 세 형식이 같은 입력을 씁니다. */
interface Table {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  /** 표 위에 붙는 요약 줄 (기간·기준일 등) */
  notes?: string[];
}

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── 형식 변환 ──────────────────────────────────────────────────

function toCsv(tables: Table[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  for (const t of tables) {
    lines.push(esc(t.title));
    for (const note of t.notes ?? []) lines.push(esc(note));
    lines.push(t.headers.map(esc).join(","));
    for (const row of t.rows) lines.push(row.map(esc).join(","));
    lines.push("");
  }
  // 엑셀이 UTF-8 을 자동 인식하도록 BOM 을 붙입니다 (없으면 한글이 깨집니다).
  return `﻿${lines.join("\n")}`;
}

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

const cellOf = (v: string | number): XlsxCell =>
  typeof v === "number" ? { value: v, type: Number } : { value: String(v), type: String };

async function toXlsx(tables: Table[]): Promise<Buffer> {
  // 시트 이름은 31자 제한 + 일부 기호 금지
  const sheetName = (t: Table) => t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

  return writeXlsxFile(
    tables.map((t) => ({
      data: [t.headers.map(headerCell), ...t.rows.map((row) => row.map(cellOf))],
      sheet: sheetName(t),
      stickyRowsCount: 1,
      columns: t.headers.map((h) => ({ width: Math.max(12, Math.min(h.length * 2.6, 32)) })),
    })),
    { fontFamily: "맑은 고딕", fontSize: 10 },
  ).toBuffer();
}

function escapeHtml(v: string | number): string {
  return String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

function toPrintableHtml(docTitle: string, tables: Table[], autoPrint: boolean): string {
  const body = tables
    .map(
      (t) => `
  <section>
    <h2>${escapeHtml(t.title)}</h2>
    ${(t.notes ?? []).map((n) => `<p class="note">${escapeHtml(n)}</p>`).join("")}
    <table>
      <thead><tr>${t.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${t.rows
        .map(
          (row) =>
            `<tr>${row
              .map(
                (v) =>
                  `<td class="${typeof v === "number" ? "num" : ""}">${escapeHtml(
                    typeof v === "number" ? won(v) : v,
                  )}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>
  </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><title>${escapeHtml(docTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1a1a1a; font-size: 10pt; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  h2 { font-size: 11.5pt; margin: 6mm 0 2mm; border-bottom: 0.6pt solid #1a1a1a; padding-bottom: 1mm; }
  p.note { margin: 0 0 1.5mm; color: #555; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  th, td { border: 0.4pt solid #bbb; padding: 1.4mm 2mm; text-align: left; }
  th { background: #f2f2f2; font-weight: 700; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .stamp { margin-top: 8mm; color: #666; font-size: 8.5pt; }
</style></head>
<body>
<h1>${escapeHtml(docTitle)}</h1>
${body}
<p class="stamp">알뜰철도 X — 이 문서의 수치는 화면과 같은 집계에서 나옵니다. 시연용 가상 데이터입니다.</p>
${autoPrint ? "<script>window.addEventListener('load', () => window.print());</script>" : ""}
</body></html>`;
}

async function pack(
  base: string,
  docTitle: string,
  tables: Table[],
  format: SheetFormat,
  autoPrint: boolean,
): Promise<ExportFile> {
  if (format === "csv") {
    return { body: toCsv(tables), filename: `${base}.csv`, contentType: "text/csv; charset=utf-8", inline: false };
  }
  if (format === "xlsx") {
    return {
      body: await toXlsx(tables),
      filename: `${base}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      inline: false,
    };
  }
  return {
    body: toPrintableHtml(docTitle, tables, autoPrint),
    filename: `${base}.html`,
    contentType: "text/html; charset=utf-8",
    inline: true,
  };
}

// ── 1. 정산 보고서 ─────────────────────────────────────────────

export function buildSettlementExport(
  res: SettlementResponse,
  format: SheetFormat,
  autoPrint = false,
): Promise<ExportFile> {
  const c = res.contract;
  const a = res.achievement;
  const r = res.recalc;

  const tables: Table[] = [
    {
      title: "이행 현황",
      notes: [`${c.name} (${c.no}) · ${c.periodFrom} ~ ${c.periodTo} · 기준일 ${res.asOf}`],
      headers: ["항목", "값"],
      rows: [
        ["협약 물량 (톤)", a.contractTon],
        ["실적 물량 (톤)", a.actualTon],
        ["이행률", pct(a.rate)],
        ["기간 경과율", pct(a.elapsedRate)],
        ["격차", `${(a.gapRate * 100).toFixed(1)}%p`],
        ["잔여 물량 (톤)", a.shortTon],
        ["잔여 일수", a.remainDays],
      ],
    },
    {
      title: "보조금 재산정",
      notes: [r.note],
      headers: ["항목", "금액 (원)"],
      rows: [
        ["A 전환 추가비용", r.additionalCostKrw],
        ["B 편익 상한 (사회적 절감 × 30%)", r.benefitCapKrw],
        [`채택 (${r.adopted})`, r.actualSubsidyKrw],
        ["협약 산정액", r.contractSubsidyKrw],
        ["차액", r.diffKrw],
      ],
    },
    {
      title: "제출 서류",
      headers: ["서류", "필수", "상태"],
      rows: res.documents.map((d) => [d.name, d.required ? "필수" : "선택", d.file ? `제출 (${d.file.name})` : "미제출"]),
    },
    {
      title: "협약 이행 이력",
      headers: ["협약", "기간", "협약(톤)", "실적(톤)", "편성", "협약 산정액", "재산정액", "차액", "상태"],
      rows: res.history.map((h) => [
        h.name,
        `${h.periodFrom} ~ ${h.periodTo}`,
        h.contractTon,
        h.actualTon,
        h.tripCount,
        h.contractSubsidyKrw,
        h.actualSubsidyKrw,
        h.diffKrw,
        h.status,
      ]),
    },
  ];

  return pack(`settlement-${c.no}`, `전환교통 협약 정산 보고서 — ${c.name}`, tables, format, autoPrint);
}

// ── 2. 화주 영업 리스트 ────────────────────────────────────────

export function buildClientsExport(
  res: ClientsResponse,
  format: SheetFormat,
  autoPrint = false,
): Promise<ExportFile> {
  const tables: Table[] = [
    {
      title: "화주 협약 이행 현황",
      notes: [`대상 기간 ${res.period.label}`],
      headers: [
        "화주",
        "업종",
        "기업 구분",
        "ESG 공시 대상",
        "주 노선",
        "협약번호",
        "협약(톤)",
        "실적(톤)",
        "이행률",
        "편성",
        "감축(tCO₂eq)",
        "상태",
      ],
      rows: res.items.map((c) => [
        c.name,
        c.industry,
        c.companyGrade,
        c.esgDisclosureRequired ? "대상" : "-",
        c.route ?? "-",
        c.contractNo,
        c.contractTon,
        c.actualTon,
        pct(c.rate),
        c.tripCount,
        c.reducedCo2Ton,
        c.status,
      ]),
    },
  ];
  return pack("korail-clients", `코레일 화주 영업 리스트 — ${res.period.label}`, tables, format, autoPrint);
}

// ── 3. 수송 실적 리포트 ────────────────────────────────────────

export function buildPerformanceExport(
  res: HistoryResponse,
  format: SheetFormat,
  autoPrint = false,
): Promise<ExportFile> {
  const rows = res.items.map((p) => [
    p.label,
    p.metrics.tripCount,
    p.metrics.legCount,
    p.metrics.shipperCount,
    p.metrics.totalTon,
    pct(p.metrics.avgLoadRate),
    p.metrics.reducedCo2Ton,
    pct(p.metrics.reductionRate),
    p.metrics.totalBenefitKrw,
  ]);

  const tables: Table[] = [
    {
      title: "분기별 수송 실적",
      notes: [`${res.persona === "korail" ? "코레일" : "화주"} 기준 · 최근 ${res.items.length}개 분기`],
      headers: [
        "분기",
        "편성",
        "로트",
        "화주 수",
        "물량(톤)",
        "평균 적재율",
        "감축(tCO₂eq)",
        "감축률",
        "사회·환경 편익(원)",
      ],
      rows,
    },
  ];

  const span = res.items.length ? `${res.items[0].label} ~ ${res.items[res.items.length - 1].label}` : "";
  return pack(`performance-${res.items[res.items.length - 1]?.period ?? "all"}`, `수송 실적 리포트 — ${span}`, tables, format, autoPrint);
}
