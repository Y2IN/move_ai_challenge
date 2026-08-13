/**
 * 별지 제3호 서식 인쇄용 HTML (api_list #39).
 *
 * HWP 생성은 마땅한 오픈소스가 없어 포기했다. **HTML → 브라우저 인쇄 → PDF** 로 간다.
 * 서식이 표 위주라 인쇄 CSS 로 충분히 재현된다.
 *
 * 이 파일은 문서를 **그리기만** 한다. 수치를 만들거나 고치지 않는다.
 */

import type { ParagraphKey, SubsidyDocument } from "../contract";
import { PARAGRAPH_SPECS } from "../paragraphs";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

/** 서식에 사용자 텍스트가 그대로 들어가므로 반드시 이스케이프한다. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(doc: SubsidyDocument, key: ParagraphKey): string {
  const p = doc.paragraphs[key];
  if (!p?.text) return "";
  const badge =
    p.source === "user" ? "담당자 수정" : p.source === "fallback" ? "템플릿" : "AI 서술";
  return `<div class="narrative">
    <p>${esc(p.text)}</p>
    <span class="badge">${badge} · ${esc(PARAGRAPH_SPECS[key].location)}</span>
  </div>`;
}

function rows(cells: (string | number)[][], align: string[] = []): string {
  return cells
    .map(
      (row) =>
        `<tr>${row
          .map((c, i) => `<td class="${align[i] ?? ""}">${typeof c === "string" ? c : esc(String(c))}</td>`)
          .join("")}</tr>`,
    )
    .join("");
}

export function renderSubsidyHtml(
  doc: SubsidyDocument,
  /** true 면 로드 직후 인쇄 대화상자를 띄웁니다. 호출부에서 HTML 을 문자열 치환하지 마세요. */
  autoPrint = false,
): string {
  const s = doc.sections;
  const today = doc.meta.createdAt.slice(0, 10).replace(/-/g, ". ");

  const planRows = rows(
    s.plan.rows.map((r) => [
      esc(r.route),
      esc(r.item),
      `${r.tons.toLocaleString("ko-KR")}톤`,
      `${r.trips}회`,
      esc(r.wagonType),
    ]),
    ["", "", "num", "num", ""],
  );

  const costRows = rows(
    s.extraCost.rows.map((r) => [
      esc(r.label),
      esc(r.formula),
      `${r.amount < 0 ? "△" : ""}${won(Math.abs(r.amount))}`,
    ]),
    ["", "", "num"],
  );

  const benefitRows = rows(
    s.benefit.items.map((i) => [esc(i.label), esc(i.basis), esc(i.source), won(i.amount)]),
    ["", "", "", "num"],
  );

  // 보조금 대상이 아니면 5번 항목의 표현이 완전히 달라진다.
  const resultBlock = s.result.eligible
    ? `<table>
        ${rows(
          [
            ["추가비용 (A)", "3. 추가비용 산출 합계", won(s.result.A)],
            ["편익 상한 (B)", "4. 편익 × 고시 상한 비율", won(s.result.B)],
            [
              `<strong>보조금 신청액</strong>`,
              `min(A, B) · ${esc(s.result.legalBasis)}`,
              `<strong>${won(s.result.subsidy)}</strong>`,
            ],
          ],
          ["", "", "num"],
        )}
      </table>`
    : `<table>
        ${rows(
          [
            ["추가비용 (A)", "철도 합적 비용 − 도로 직행 비용", `△${won(Math.abs(s.result.A))}`],
            ["편익 상한 (B)", "4. 편익 × 고시 상한 비율", won(s.result.B)],
            [
              `<strong>보조금 신청액</strong>`,
              "전환 추가비용 미발생 — 신청 대상 아님",
              `<strong>${won(0)}</strong>`,
            ],
          ],
          ["", "", "num"],
        )}
      </table>
      <p class="note">철도 연계 운송 비용이 기존 도로 운송비보다 낮아 전환 추가비용이 발생하지 않았습니다.
      산출된 사회환경적 편익은 온실가스 공시 자료로 활용합니다.</p>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>전환교통 보조금 사업계획서 · ${esc(doc.meta.period.label)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Pretendard", -apple-system, "Malgun Gothic", sans-serif;
         font-size: 10.5pt; line-height: 1.65; color: #111; margin: 0; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 4px; letter-spacing: -0.4px; }
  .form-tag { text-align: center; font-size: 9pt; color: #666; margin-bottom: 2px; }
  .legal { text-align: center; font-size: 8.5pt; color: #666; margin-bottom: 18px;
           padding-bottom: 12px; border-bottom: 2px solid #111; }
  h2 { font-size: 11.5pt; margin: 20px 0 8px; padding-left: 7px;
       border-left: 3px solid #111; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; font-weight: 600; white-space: nowrap; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.total td { background: #f7f7f7; font-weight: 600; }
  .narrative { margin: 8px 0 4px; padding: 10px 12px; background: #fafafa;
               border-left: 2px solid #ccc; page-break-inside: avoid; }
  .narrative p { margin: 0; text-align: justify; }
  .badge { display: inline-block; margin-top: 6px; font-size: 8pt; color: #777; }
  .note { font-size: 9pt; color: #555; margin: 6px 0 0; }
  .disclaimer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #ddd;
                font-size: 8.5pt; color: #666; }
  .sign { margin-top: 26px; text-align: center; font-size: 10.5pt; page-break-inside: avoid; }
  ol { margin: 4px 0 0 18px; padding: 0; }
  @media print { .no-print { display: none; } body { font-size: 10pt; } }
</style></head><body>

<div class="form-tag">[${esc(doc.meta.form)} 서식]</div>
<h1>전환교통 지원사업 사업계획서</h1>
<div class="legal">
  근거: ${esc(s.result.legalBasis)}<br>
  대상 기간: ${esc(doc.meta.period.from)} ~ ${esc(doc.meta.period.to)} (${esc(doc.meta.period.label)})
  · 작성일 ${esc(today)} · 계수 버전 ${esc(doc.meta.coefficientVersion)}
</div>

${para(doc, "overview")}

<h2>1. 신청인</h2>
<table>
  <tr><th>상호</th><td>${esc(s.applicant.name)}</td><th>사업자등록번호</th><td>${esc(s.applicant.bizNo)}</td></tr>
  <tr><th>대표자</th><td>${esc(s.applicant.ceo)}</td><th>담당자</th><td>${esc(s.applicant.manager)} · ${esc(s.applicant.phone)}</td></tr>
  <tr><th>소재지</th><td colspan="3">${esc(s.applicant.address)}</td></tr>
</table>

<h2>2. 전환 계획</h2>
<table>
  <tr><th>구간</th><th>품목</th><th>전환물량</th><th>수송횟수</th><th>화차형식</th></tr>
  ${planRows}
  <tr class="total">
    <td>합계</td><td>${s.plan.total.itemCount}개 품목</td>
    <td class="num">${s.plan.total.tons.toLocaleString("ko-KR")}톤</td>
    <td class="num">${s.plan.total.trips}회</td>
    <td>${s.plan.total.wagonTypeCount}종</td>
  </tr>
</table>
<p class="note">평균 적재율 ${pct(s.plan.avgLoadRate)}</p>
${para(doc, "plan")}

<h2>3. 추가비용 산출</h2>
<table>
  <tr><th>항목</th><th>산식</th><th>금액</th></tr>
  ${costRows}
  <tr class="total">
    <td colspan="2">추가비용 계 (A)</td>
    <td class="num">${s.extraCost.totalA < 0 ? "△" : ""}${won(Math.abs(s.extraCost.totalA))}</td>
  </tr>
</table>
${para(doc, "extraCost")}

<h2>4. 사회환경적 편익</h2>
<table>
  <tr><th>편익 항목</th><th>산출 근거</th><th>계수 출처</th><th>환산액</th></tr>
  ${benefitRows}
  <tr class="total"><td colspan="3">편익 계 (B)</td><td class="num">${won(s.benefit.totalB)}</td></tr>
</table>
<p class="note">온실가스 감축량 ${s.benefit.co2ReducedTon} tCO₂eq (${pct(s.benefit.co2ReductionRate)} 저감)
 · 소나무 ${s.benefit.equivalents.pineTrees.toLocaleString("ko-KR")}그루 식재 효과
 · 대형 트럭 ${s.benefit.equivalents.trucksBlocked}대 상당</p>
${para(doc, "benefit")}

<h2>5. 보조금 산정 결과</h2>
${resultBlock}
${para(doc, "result")}

<h2>6. 첨부 서류</h2>
<ol>${s.attachments.items.map((i) => `<li>${esc(i.replace(/^[①-⑨]\s*/, ""))}</li>`).join("")}</ol>
${para(doc, "closing")}

<div class="disclaimer">
  수치는 법정 산식과 고정 계수로 계산되며, AI는 서술 문장만 작성합니다.
  서술 문단은 담당자가 수정할 수 있습니다. 제출 전 5번 항목의 산정 결과를 관할 담당자와 확인하십시오.
</div>

<div class="sign">
  위와 같이 전환교통 지원사업 사업계획서를 제출합니다.<br><br>
  ${esc(today)}<br><br>
  신청인 ${esc(s.applicant.name)} 대표이사 ${esc(s.applicant.ceo)} (인)
</div>

<script>if (${autoPrint ? "true" : 'location.search.includes("print=1")'}) window.print();</script>
</body></html>`;
}
