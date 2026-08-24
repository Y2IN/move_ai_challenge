import type { ParseResponse } from '@railhub/be/parse';
import type { FreightField } from '../lib/freight';

/** 채웠는지 따지는 핵심 항목과 화면 라벨 */
export const CORE_FIELDS: ReadonlyArray<{ key: FreightField; label: string }> = [
  { key: 'originStationId', label: '출발역' },
  { key: 'destStationId', label: '도착역' },
  { key: 'tons', label: '중량' },
  { key: 'departDate', label: '희망 출발일' },
];

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-08-25" → "8월 25일 (화)". 로컬 자정으로 만들어 UTC 하루 밀림을 피합니다. */
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEKDAY[date.getDay()]})`;
}

/** 오늘로부터 며칠 뒤인지 — "'다음주 토요일' → 9월 5일" 옆에 "12일 뒤" 를 붙이면 감이 옵니다. */
function daysFrom(todayIso: string, targetIso: string): string {
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [y, m, d] = targetIso.split('-').map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff < 0) return `${-diff}일 전`;
  return `${diff}일 뒤`;
}

interface ParseResultPanelProps {
  result: ParseResponse;
  /** 실제로 값이 들어간 필드 (배지가 붙은 것들) */
  filled: ReadonlyArray<FreightField>;
  /** 비어 있는 핵심 필드를 누르면 그 칸으로 데려갑니다 */
  onJump: (key: FreightField) => void;
  onDismiss: () => void;
}

/**
 * "AI로 채우기" 결과 안내.
 *
 * 예전엔 주황색 경고 문장이 줄줄이 붙었습니다 — "departDate: 상대 날짜 '내일'을 …로 환산함",
 * "직접 채워야 하는 항목이 있습니다". 뭘 채웠고 뭘 더 해야 하는지가 한눈에 안 들어왔습니다.
 *
 * 여기서는 세 가지를 나눠 보여줍니다.
 *   1. 어디서 온 결과인지 (AI / 예시 케이스) + 몇 개를 채웠는지
 *   2. 날짜를 어떻게 읽었는지 — "'내일' → 8월 25일 (화)". 도착 기한이면 출발일에 안 넣었다고 알립니다
 *   3. 비어 있는 칸 — 누르면 그 칸으로 스크롤하고 포커스가 갑니다
 */
export function ParseResultPanel({ result, filled, onJump, onDismiss }: ParseResultPanelProps) {
  const isAi = result.source === 'ai';
  const filledCore = CORE_FIELDS.filter((f) => filled.includes(f.key));
  const missing = CORE_FIELDS.filter((f) => !filled.includes(f.key));
  const date = result.dateResolution;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#E5E8EB] bg-[#F9FAFB] p-5">
      {/* 1. 출처 + 요약 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            title={result.notice}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-[5px] text-[13px] font-bold ${
              isAi ? 'bg-[#E8F3FF] text-[#1B64DA]' : 'bg-[#FFF4E0] text-[#C77700]'
            }`}
          >
            {isAi ? '✦ AI가 읽었어요' : '예시 케이스로 채움'}
          </span>
          <span className="text-[15px] font-semibold text-[#191F28]">
            {filledCore.length === CORE_FIELDS.length
              ? '필수 항목을 모두 채웠어요'
              : filledCore.length === 0
                ? '문장에서 필수 항목을 찾지 못했어요'
                : `${filledCore.length}개 항목을 채웠어요 · ${missing.length}개는 직접 골라주세요`}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="안내 닫기"
          className="rounded-md px-2 py-1 text-[13px] font-semibold text-[#8B95A1] transition-colors hover:bg-[#F2F4F6] hover:text-[#4E5968]"
        >
          닫기
        </button>
      </div>

      {/* 2. 날짜를 어떻게 읽었는지 */}
      {date && (
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-[14px] ${
            date.kind === 'depart' ? 'bg-[#E8F3FF] text-[#1B64DA]' : 'bg-[#FFF4E0] text-[#C77700]'
          }`}
        >
          <span className="text-base" aria-hidden>
            📅
          </span>
          <span>
            <b className="font-bold">‘{date.expression}’</b>
            <span className="mx-1.5 opacity-60">→</span>
            <b className="font-bold">{prettyDate(date.date)}</b>
            <span className="ml-1.5 opacity-70">· {daysFrom(date.today, date.date)}</span>
          </span>
          <span className="ml-auto text-[13px] opacity-70">
            {date.kind === 'depart'
              ? `오늘 ${prettyDate(date.today)} 기준`
              : '도착 기한이라 출발일엔 넣지 않았어요'}
          </span>
        </div>
      )}

      {/* 3. 채운 것 / 남은 것 */}
      <div className="flex flex-col gap-2.5">
        {filledCore.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] font-semibold text-[#8B95A1]">채웠어요</span>
            {filledCore.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#4E5968] ring-1 ring-[#E5E8EB]"
              >
                <span className="text-[#1B64DA]">✓</span>
                {f.label}
              </span>
            ))}
          </div>
        )}
        {missing.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] font-semibold text-[#C77700]">직접 골라주세요</span>
            {missing.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onJump(f.key)}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-bold text-[#191F28] ring-1 ring-[#FFD592] transition-colors hover:bg-[#FFF4E0]"
              >
                {f.label}
                <span aria-hidden className="text-[#C77700]">
                  ↓
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 남은 경고 — 서버가 뭘 버렸는지 (문장에 없는 중량 등) */}
      {result.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-[#E5E8EB] pt-3">
          {result.warnings.map((w) => (
            <li key={w} className="flex gap-1.5 text-[13px] leading-relaxed text-[#6B7684]">
              <span aria-hidden className="text-[#C77700]">
                !
              </span>
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
