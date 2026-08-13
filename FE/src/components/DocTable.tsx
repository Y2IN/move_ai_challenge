'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** 관공서 서식 표. 실선 테두리 + 회색 헤더 */
export function DocTable({ children }: { children: ReactNode }) {
  return <div className="border border-[#B0B8C1] text-sm">{children}</div>;
}

export function DocRow({
  cols,
  children,
  head,
  total,
  accent,
}: {
  cols: string;
  children: ReactNode;
  head?: boolean;
  total?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'grid border-b border-[#D1D6DB] last:border-b-0',
        head ? 'bg-[#F2F4F6] font-bold text-[#4E5968]' : 'text-[#191F28]',
        total ? 'bg-[#F9FAFB] font-extrabold' : '',
        accent ? 'bg-[#F5F9FF] font-extrabold' : '',
      ].join(' ')}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export function DocCell({
  children,
  right,
  last,
  label,
  span,
  className = '',
}: {
  children?: ReactNode;
  right?: boolean;
  /** 오른쪽 세로선 제거 */
  last?: boolean;
  /** 라벨 셀 (회색 배경) */
  label?: boolean;
  span?: number;
  className?: string;
}) {
  return (
    <span
      className={[
        'px-[13px] py-[11px]',
        last ? '' : 'border-r border-[#D1D6DB]',
        right ? 'text-right' : '',
        label ? 'bg-[#F2F4F6] font-bold text-[#4E5968]' : '',
        className,
      ].join(' ')}
      style={span ? { gridColumn: `span ${span}` } : undefined}
    >
      {children}
    </span>
  );
}

/** 자동 산출 수치임을 나타내는 회색 산식 배지 */
export function FormulaBadge({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return (
    <span
      className={`rounded-md bg-[#F2F4F6] px-2 py-[3px] text-xs font-semibold text-[#6B7684] ${
        numeric ? 'tabular-nums' : ''
      }`}
    >
      {children}
    </span>
  );
}

export function DocSectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">{children}</div>;
}

/** 문서 상단 안내 + 범례 */
export function DocLegend({ note }: { note: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] bg-[#F9FAFB] px-4 py-3">
      <span className="flex-1 text-[13px] font-bold text-[#4E5968]">{note}</span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7684]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[#E5E8EB]" />
        자동 산출 수치
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7684]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[#D6E7FF]" />
        AI 서술
      </span>
    </div>
  );
}

/**
 * 문단 출처별 톤. BE EsgSection.source 와 1:1 입니다.
 *
 *   ai        생성 AI 작성 + 숫자 검증 통과 (파랑)
 *   fallback  사전 작성 서술 초안 — 인증 없음·호출 실패·검증 실패 (회색)
 *   user      숫자 검증을 거치지 않은 문단 — 직접 편집분·클라이언트 제공분 (호박색)
 */
export type ParagraphTone = 'ai' | 'fallback' | 'user';

const TONE_STYLE: Record<
  ParagraphTone,
  { border: string; bg: string; chip: string; text: string; badge: string; label: string }
> = {
  ai: {
    border: 'border-[#3182F6]',
    bg: 'bg-[#F5F9FF]',
    chip: 'bg-[#D6E7FF]',
    text: 'text-[#1B64DA]',
    badge: 'AI',
    label: 'AI 에이전트 서술 · 숫자 검증 통과 · 편집 가능',
  },
  fallback: {
    border: 'border-[#8B95A1]',
    bg: 'bg-[#F9FAFB]',
    chip: 'bg-[#E5E8EB]',
    text: 'text-[#4E5968]',
    // 배지가 "템플릿" 이면 미완성으로 읽힙니다. 실제로는 수치가 살아 있는 정식 문단이고
    // 서술만 사전 작성분입니다. 배지에서 그 사실이 먼저 보여야 합니다.
    //
    // 라벨은 **이 블록이 원래 무엇인지**부터 말합니다 — AI 에이전트가 산정 수치를 읽고
    // 공시 문체로 쓰는 자리입니다. 그 역할을 안 적으면 폴백 문단이 그냥 하드코딩된
    // 문장으로 보이고, 에이전트가 하는 일이 화면에서 사라집니다.
    // "재생성하면 바뀐다"도 여기 둡니다. BE 경고 줄에 같이 쓰면 문단마다 반복됩니다.
    badge: '데모',
    label: 'AI 에이전트 서술 영역 · 현재는 사전 작성 초안 · ↻ 재생성하면 바뀝니다',
  },
  user: {
    border: 'border-[#F2B33D]',
    bg: 'bg-[#FFF8EB]',
    chip: 'bg-[#FCEBC5]',
    text: 'text-[#A96A00]',
    badge: '검증 필요',
    label: '숫자 검증을 거치지 않은 문단 · 직접 편집분',
  },
};

const CHIP_BUTTON =
  'rounded-lg border bg-white px-2.5 py-[5px] text-xs font-bold transition-opacity disabled:cursor-default disabled:text-[#B0B8C1]';

/**
 * AI가 쓴 서술 문단. hover 시 재생성·편집 칩이 뜬다.
 *
 * **편집이 필요한 이유:** 공시 문단은 결국 담당자가 사내 표현으로 손봅니다. 문체를
 * 바꾸고 싶을 때마다 재생성을 돌리는 건 답이 아닙니다 — 재생성은 문장을 통째로
 * 갈아치우므로 마음에 들던 부분까지 사라집니다.
 *
 * 편집한 문단은 호출자가 출처를 `user` 로 내립니다. AI가 쓴 것도, 우리가 준비한
 * 초안도 아닌 문장이 파란 "AI 서술 · 숫자 검증 통과" 배지를 달고 있으면 안 됩니다.
 */
export function AiParagraphBlock({
  body,
  onRegenerate,
  onEdit,
  className = '',
  tone = 'ai',
  label,
  busy = false,
  footer,
}: {
  body: string;
  onRegenerate?: () => void;
  /** 본문 직접 편집. 생략하면 편집 버튼이 뜨지 않습니다 */
  onEdit?: (next: string) => void;
  className?: string;
  /** 문단 출처. 생략하면 기존과 동일한 AI(파랑) 스타일 */
  tone?: ParagraphTone;
  /** 배지 옆 라벨 문구 오버라이드 */
  label?: string;
  /** 재생성 진행 중 — 본문을 흐리게 하고 재생성 버튼을 잠근다 */
  busy?: boolean;
  /** 경고 등 본문 아래 붙는 노드 */
  footer?: ReactNode;
}) {
  const t = TONE_STYLE[tone];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // 편집 중에 재생성이 끝나 본문이 바뀌면 편집을 접습니다. 그대로 두면 사용자가
  // 저장하는 순간 방금 생성된 문장을 낡은 초안으로 덮어씁니다.
  useEffect(() => {
    setEditing(false);
    setDraft(body);
  }, [body]);

  useEffect(() => {
    if (!editing) return;
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    // 빈 문단을 저장하면 공시 서식에 구멍이 뚫립니다. 안 바뀐 경우도 굳이 출처를
    // 내릴 이유가 없습니다.
    if (next && next !== body) onEdit?.(next);
    setEditing(false);
    setDraft(next || body);
  };

  const cancel = () => {
    setDraft(body);
    setEditing(false);
  };

  return (
    <div
      className={`group relative rounded-r-[10px] border-l-[3px] ${t.border} ${t.bg} px-[18px] pb-4 pt-3.5 ${className}`}
    >
      <div className="flex items-center gap-[7px]">
        <span
          className={`inline-flex h-4 items-center justify-center rounded ${t.chip} px-1.5 text-[10px] font-extrabold tracking-wide ${t.text}`}
        >
          {t.badge}
        </span>
        <span className={`text-[11px] font-bold ${t.text}`}>
          {busy ? '문단 재생성 중…' : editing ? '편집 중 · 저장하면 「검증 필요」로 표시됩니다' : (label ?? t.label)}
        </span>
      </div>

      {editing ? (
        <textarea
          ref={areaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Esc 로 취소, ⌘/Ctrl+Enter 로 저장. Enter 는 줄바꿈이어야 하므로 잡지 않습니다.
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
          rows={Math.max(4, Math.ceil(draft.length / 60))}
          className="mt-2 w-full resize-y rounded-lg border border-[#D1D6DB] bg-white px-3 py-2.5 text-sm leading-[1.85] text-[#333D4B] outline-none focus:border-[#3182F6]"
        />
      ) : (
        <p className={`mt-2 text-sm leading-[1.85] text-[#333D4B] ${busy ? 'animate-pulse opacity-50' : ''}`}>
          {body}
        </p>
      )}

      {editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={commit}
            className={`${CHIP_BUTTON} border-[#3182F6] bg-[#3182F6] text-white`}
          >
            저장
          </button>
          <button type="button" onClick={cancel} className={`${CHIP_BUTTON} border-[#D1D6DB] text-[#4E5968]`}>
            취소
          </button>
          <span className="text-[11px] text-[#8B95A1]">⌘+Enter 저장 · Esc 취소</span>
        </div>
      ) : (
        footer
      )}

      {!editing && (onRegenerate || onEdit) && (
        <div className="absolute right-3.5 top-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className={`${CHIP_BUTTON} border-[#D1D6DB] text-[#4E5968]`}
            >
              ✎ 편집
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              disabled={busy}
              onClick={onRegenerate}
              className={`${CHIP_BUTTON} border-[#D6E7FF] text-[#3182F6]`}
            >
              {busy ? '생성 중…' : '↻ 문단 재생성'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A4 비율 문서 용지 */
export function DocSheet({ children, minHeight = 1120 }: { children: ReactNode; minHeight?: number }) {
  return (
    <div
      className="flex w-full flex-col gap-[26px] rounded-md border border-[#E5E8EB] bg-white px-[60px] pb-16 pt-14 shadow-[0_8px_28px_rgba(25,31,40,0.07)]"
      style={{ minHeight }}
    >
      {children}
    </div>
  );
}
