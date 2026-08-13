import {
  AiParagraphBlock,
  DocCell,
  DocLegend,
  DocRow,
  DocSheet,
  DocTable,
  FormulaBadge,
} from '../components/DocTable';
import { applyMeta, esgHeader, esgRows, paragraphs } from '../mocks/apply';

const ESG_COLS = '100px 1.2fr 1.4fr 1.1fr';

/** 06c 탭 2 — K-ESG 지표표 */
export function EsgIndicatorTable({ onRegenerate }: { onRegenerate?: (id: string) => void }) {
  return (
    <DocSheet minHeight={720}>
      <header className="border-b-2 border-[#191F28] pb-[22px] text-center">
        <div className="text-[15px] font-semibold tracking-wide text-[#6B7684]">{esgHeader.formNo}</div>
        <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-[#191F28]">{esgHeader.title}</h2>
        <div className="mt-3 text-[13px] leading-[1.7] text-[#6B7684]">
          {esgHeader.meta}
          <br />
          {esgHeader.org}
        </div>
      </header>

      <DocLegend note={applyMeta.disclaimer} />

      <DocTable>
        <DocRow cols={ESG_COLS} head>
          <DocCell>항목번호</DocCell>
          <DocCell>항목명</DocCell>
          <DocCell>산출값</DocCell>
          <DocCell last>산정 근거</DocCell>
        </DocRow>

        {esgRows.map((r) => (
          <DocRow key={r.code} cols={ESG_COLS}>
            <DocCell className="font-bold tabular-nums">{r.code}</DocCell>
            <DocCell>{r.name}</DocCell>
            <DocCell>
              <FormulaBadge numeric>{r.value}</FormulaBadge>
            </DocCell>
            <DocCell last className="text-xs text-[#6B7684]">
              {r.source}
            </DocCell>
          </DocRow>
        ))}
      </DocTable>

      <AiParagraphBlock body={paragraphs.esg.body} onRegenerate={() => onRegenerate?.(paragraphs.esg.id)} />

      <footer className="mt-2.5 border-t border-[#E5E8EB] pt-[18px] text-[13px] leading-[1.8] text-[#6B7684]">
        {esgHeader.guideline}
      </footer>
    </DocSheet>
  );
}
