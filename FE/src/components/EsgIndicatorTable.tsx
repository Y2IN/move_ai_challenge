import {
  AiParagraphBlock,
  DocCell,
  DocLegend,
  DocRow,
  DocSheet,
  DocTable,
  FormulaBadge,
} from "../components/DocTable";
import type {
  EsgGenerationInfo,
  EsgPeriod,
  EsgSection,
  EsgSectionKey,
  KesgIndicator,
} from "../lib/esg";
import { formatDateTime, formatDocDate } from "../lib/format";

const ESG_COLS = "100px 1.2fr 1.4fr 1.1fr";

const GUIDELINE =
  "공급망 실사 대응 K-ESG 가이드라인 (산업통상자원부 · 한국생산성본부) 기준으로 작성되었습니다.";

export interface EsgIndicatorTableProps {
  period: EsgPeriod;
  shipperName: string | null;
  coefficientVersion: string;
  verified: boolean;
  indicators: KesgIndicator[];
  disclaimer: string;
  /** #41 응답의 문단. null 이면 아직 생성 중 */
  sections: EsgSection[] | null;
  generation: EsgGenerationInfo | null;
  generatedAt: string | null;
  /** 문단 생성 실패 메시지 (지표표는 살아 있으므로 문단 자리에만 표시) */
  reportError: string | null;
  /** 재생성이 진행 중인 문단 key */
  busyKeys: readonly EsgSectionKey[];
  onRegenerateSection?: (key: EsgSectionKey) => void;
  /** 문단 직접 편집 — 저장하면 출처가 `user`(검증 필요)로 내려갑니다 */
  onEditSection?: (key: EsgSectionKey, text: string) => void;
  onRetryReport?: () => void;
}

/** KesgMetric 은 표시용 문자열이 이미 완성돼 있어 그대로 나열만 합니다. */
function MetricLines({ indicator }: { indicator: KesgIndicator }) {
  const main = indicator.metrics.filter((m) => !m.supplementary);
  return (
    <span className="mt-1.5 flex flex-col gap-0.5">
      {main.map((m) => (
        <span key={m.label} className="text-xs leading-[1.6] text-[#6B7684]">
          {m.label} <b className="tabular-nums text-[#4E5968]">{m.value}</b>{" "}
          {m.unit}
        </span>
      ))}
    </span>
  );
}

function SectionBlocks({
  sections,
  busyKeys,
  onRegenerateSection,
  onEditSection,
}: {
  sections: EsgSection[];
  busyKeys: readonly EsgSectionKey[];
  onRegenerateSection?: (key: EsgSectionKey) => void;
  onEditSection?: (key: EsgSectionKey, text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => (
        <section key={s.key}>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-[#191F28]">
              {s.title}
            </span>
            <span className="text-[11px] text-[#8B95A1]">{s.standard}</span>
          </div>
          <AiParagraphBlock
            className="mt-2"
            tone={s.source}
            body={s.text}
            busy={busyKeys.includes(s.key)}
            onRegenerate={
              onRegenerateSection ? () => onRegenerateSection(s.key) : undefined
            }
            onEdit={
              onEditSection ? (text) => onEditSection(s.key, text) : undefined
            }
            footer={
              s.warnings.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {s.warnings.map((w, i) => (
                    // 경고 문구는 중복될 수 있어 텍스트를 key 로 쓰면 안 됩니다.
                    <li
                      key={`${s.key}-w${i}`}
                      className="text-[11px] leading-[1.6] text-[#A96A00]">
                      ⚠ {w}
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        </section>
      ))}
    </div>
  );
}

/** 06c 탭 2 — K-ESG 지표표. 수치는 #40, 서술 문단은 #41 응답을 그대로 그립니다. */
export function EsgIndicatorTable({
  period,
  shipperName,
  coefficientVersion,
  verified,
  indicators,
  disclaimer,
  sections,
  generation,
  generatedAt,
  reportError,
  busyKeys,
  onRegenerateSection,
  onEditSection,
  onRetryReport,
}: EsgIndicatorTableProps) {
  return (
    <DocSheet minHeight={720}>
      <header className="border-b-2 border-[#191F28] pb-[22px] text-center">
        <div className="text-[15px] font-semibold tracking-wide text-[#6B7684]">
          [공시 증빙용]
        </div>
        <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-[#191F28]">
          「K-ESG 지표표」
        </h2>
        <div className="mt-3 text-[13px] leading-[1.7] text-[#6B7684]">
          대상 기간: {formatDocDate(period.from)} ~ {formatDocDate(period.to)} (
          {period.label}) · 환경(E) 영역
          <br />
          {shipperName ?? "알뜰철도 X 참여 화주 전체"} · 물류 부문 Scope 3 ·
          계수 {coefficientVersion}
        </div>
      </header>

      <DocLegend note={disclaimer} />

      {!verified && (
        <div className="rounded-[10px] bg-[#FFF8EB] px-4 py-3 text-[13px] font-semibold leading-[1.6] text-[#A96A00]">
          ⚠ 적용 계수({coefficientVersion})는 1차 출처 확인 전입니다. 출처 확정
          시 소급 재산정됩니다.
        </div>
      )}

      <DocTable>
        <DocRow cols={ESG_COLS} head>
          <DocCell>항목번호</DocCell>
          <DocCell>항목명</DocCell>
          <DocCell>산출값</DocCell>
          <DocCell last>출처</DocCell>
        </DocRow>

        {indicators.map((r) => (
          <DocRow key={r.code} cols={ESG_COLS}>
            <DocCell className="font-bold tabular-nums">{r.code}</DocCell>
            <DocCell>
              {r.name}
              <span className="mt-1 block text-[11px] leading-[1.5] text-[#8B95A1]">
                {r.frameworks.join(" · ")}
              </span>
            </DocCell>
            <DocCell>
              <FormulaBadge numeric>
                {r.headline}
                {r.headlineUnit ? ` ${r.headlineUnit}` : ""}
              </FormulaBadge>
              <MetricLines indicator={r} />
            </DocCell>
            <DocCell last className="text-xs leading-[1.6] text-[#6B7684]">
              {r.source}
            </DocCell>
          </DocRow>
        ))}
      </DocTable>

      <section className="flex flex-col gap-1.5 rounded-[10px] bg-[#F9FAFB] px-4 py-3.5">
        <span className="text-[13px] font-bold text-[#4E5968]">산정 근거</span>
        {indicators.map((r) => (
          <p key={r.code} className="text-xs leading-[1.7] text-[#6B7684]">
            <b className="tabular-nums text-[#4E5968]">[{r.code}]</b> {r.basis}
          </p>
        ))}
      </section>

      {sections ? (
        <SectionBlocks
          sections={sections}
          busyKeys={busyKeys}
          onRegenerateSection={onRegenerateSection}
          onEditSection={onEditSection}
        />
      ) : reportError ? (
        <div className="flex flex-col gap-3 rounded-r-[10px] border-l-[3px] border-[#D22030] bg-[#FFF5F5] px-[18px] py-4">
          <span className="text-sm leading-[1.7] text-[#D22030]">
            서술 문단을 생성하지 못했습니다 — {reportError}
          </span>
          {onRetryReport && (
            <button
              type="button"
              onClick={onRetryReport}
              className="self-start rounded-lg border border-[#D22030] bg-white px-3 py-1.5 text-xs font-bold text-[#D22030]">
              ↻ 다시 생성
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-r-[10px] border-l-[3px] border-[#3182F6] bg-[#F5F9FF] px-[18px] pb-4 pt-3.5">
          <div className="flex items-center gap-[7px]">
            <span className="inline-flex h-4 items-center justify-center rounded bg-[#D6E7FF] px-1.5 text-[10px] font-extrabold tracking-wide text-[#1B64DA]">
              AI
            </span>
            <span className="text-[11px] font-bold text-[#1B64DA]">
              서술 문단 생성 중… (약 10초)
            </span>
          </div>
          <div className="mt-3 flex animate-pulse flex-col gap-2">
            <span className="h-3 w-full rounded bg-[#D6E7FF]" />
            <span className="h-3 w-4/5 rounded bg-[#D6E7FF]" />
            <span className="h-3 w-2/3 rounded bg-[#D6E7FF]" />
          </div>
        </div>
      )}

      {generation && (
        <p className="text-xs leading-[1.7] text-[#8B95A1]">
          {generatedAt ? `${formatDateTime(generatedAt)} 생성` : ""} · 모델{" "}
          {generation.model} · AI 서술 {generation.aiCount}개 · 사전 작성 서술{" "}
          {generation.fallbackCount}개
          {generation.fallbackCount > 0 && (
            <>
              <br />
              {/*
                심사자가 읽는 줄입니다. 개발 환경 복구 명령은 여기 두지 않습니다 (README 참조).
                조건이 authMode==='none' 이 아니라 fallbackCount 인 이유: 인증이 있어도
                호출 한도(429)에 걸리면 문단이 폴백으로 떨어지는데, 그때가 시연 중 제일 흔합니다.
              */}
              <span className="text-[#A96A00]">
                ⚠ 데모 모드 — 서술 문단 {generation.fallbackCount}개는 AI
                에이전트가 실시간으로 쓰는 자리이나, 호출 한도·인증 문제로
                지금은 사전 작성 초안이 표시됩니다. 지표표의 수치는 모두 실제
                산정 결과이며 AI가 만들지 않습니다.
              </span>
            </>
          )}
        </p>
      )}

      <footer className="mt-2.5 border-t border-[#E5E8EB] pt-[18px] text-[13px] leading-[1.8] text-[#6B7684]">
        {GUIDELINE}
      </footer>
    </DocSheet>
  );
}
