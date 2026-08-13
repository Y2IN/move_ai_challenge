/**
 * 화물 다건 등록 (#12) — CSV 파싱 + 미리보기/확정 2단계.
 *
 * ⚠️ xlsx 바이너리 리더 의존성이 없어 CSV 로 받는다 (엑셀에서 "다른 이름으로 저장 → CSV").
 *    xlsx 직접 파싱이 필요하면 read-excel-file 등 리더를 추가한다.
 *
 * 흐름: 파일 업로드 → previewBulk(검증만, 저장 안 함) → 사용자가 확인 →
 *       commitBulk(유효 행만 등록). 검증·정규화는 단건과 동일한 validateShipmentInput 재사용.
 *
 * CSV 헤더는 ShipmentInput 키를 그대로 쓴다:
 *   originStationId,destStationId,category,weightTon,desiredDepartureDate,companyGrade,transportArrangement
 */

import { registerShipment, validateShipmentInput } from "./store";
import { seed } from "./seed";
import type { SeedData, Shipment } from "./types";

export interface BulkRowResult {
  /** 1-based 데이터 행 번호 (헤더 제외) */
  row: number;
  ok: boolean;
  errors: Record<string, string>;
  raw: Record<string, string>;
}

export interface BulkPreview {
  mode: "preview";
  total: number;
  valid: number;
  invalid: number;
  rows: BulkRowResult[];
}

export interface BulkCommitResult {
  mode: "commit";
  total: number;
  registered: Shipment[];
  /** 검증 실패로 건너뛴 행 */
  skipped: BulkRowResult[];
}

/** 미리보기 — 검증만 하고 저장하지 않는다. */
export function previewBulk(csv: string, data: SeedData = seed): BulkPreview {
  const rows = parseCsv(csv).map((raw, i) => {
    const v = validateShipmentInput(raw, data);
    return { row: i + 1, ok: v.ok, errors: v.errors, raw };
  });
  const valid = rows.filter((r) => r.ok).length;
  return { mode: "preview", total: rows.length, valid, invalid: rows.length - valid, rows };
}

/** 확정 — 유효한 행만 등록하고, 실패한 행은 사유와 함께 돌려준다. */
export function commitBulk(csv: string, data: SeedData = seed): BulkCommitResult {
  const registered: Shipment[] = [];
  const skipped: BulkRowResult[] = [];
  parseCsv(csv).forEach((raw, i) => {
    const v = validateShipmentInput(raw, data);
    if (v.ok && v.value) registered.push(registerShipment(v.value, data));
    else skipped.push({ row: i + 1, ok: false, errors: v.errors, raw });
  });
  return { mode: "commit", total: registered.length + skipped.length, registered, skipped };
}

// ── CSV 파싱 ───────────────────────────────────────────────────

/** 첫 줄을 헤더로, 각 줄을 {헤더:값} 객체로. 따옴표로 감싼 쉼표는 보존. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
