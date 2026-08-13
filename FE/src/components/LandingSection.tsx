import type { ReactNode } from 'react';

/** 랜딩 섹션 헤더. 배지 + 제목 + 설명 중앙 정렬 */
export function SectionHeader({
  badge,
  title,
  lead,
}: {
  badge: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="text-center">
      <span className="inline-block rounded-full bg-[#E8F3FF] px-3 py-1.5 text-[13px] font-bold text-[#1B64DA]">
        {badge}
      </span>
      <h2 className="mt-3.5 text-[32px] font-extrabold tracking-[-0.035em] text-[#191F28]">{title}</h2>
      {/* lead의 \n을 줄바꿈으로 살림 */}
      <p className="mx-auto mt-2.5 max-w-[760px] whitespace-pre-line text-[17px] leading-[1.6] text-[#6B7684]">
        {lead}
      </p>
    </div>
  );
}

/** 구분선으로 나뉘는 랜딩 하위 섹션 */
export function LandingSection({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="mt-11 flex scroll-mt-[92px] flex-col gap-8 border-t border-[#F2F4F6] pt-14">
      {children}
    </div>
  );
}

/** AI 배지 (작은 사각 칩) */
export function AiChip({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded bg-[#D6E7FF] font-extrabold text-[#1B64DA] ${
        small ? 'h-3.5 px-[5px] text-[9px]' : 'h-[15px] px-[5px] text-[9px]'
      }`}
    >
      AI
    </span>
  );
}

/** 문서 미리보기용 회색 산식 배지 */
export function MiniFormula({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[5px] bg-[#F2F4F6] px-1.5 py-0.5 font-semibold text-[#6B7684]">{children}</span>
  );
}

/** 문서 미리보기 용지 */
export function MiniSheet({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[18px] rounded-lg border border-[#E5E8EB] bg-white px-7 pb-7 pt-[26px] shadow-[0_8px_28px_rgba(25,31,40,0.07)]">
      {children}
    </div>
  );
}

export function MiniSheetHeader({ formNo, title }: { formNo: string; title: string }) {
  return (
    <div className="border-b-2 border-[#191F28] pb-3.5 text-center">
      <div className="text-[11px] font-semibold text-[#8B95A1]">{formNo}</div>
      <div className="mt-[7px] text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">{title}</div>
    </div>
  );
}

/** 문서 미리보기 안의 AI 서술 문단 */
export function MiniAiParagraph({ body, caption }: { body: string; caption: string }) {
  return (
    <div className="rounded-r-lg border-l-[3px] border-[#3182F6] bg-[#F5F9FF] px-3.5 pb-3.5 pt-3">
      <div className="flex items-center gap-1.5">
        <AiChip small />
        <span className="text-[10px] font-bold text-[#1B64DA]">{caption}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-[1.8] text-[#333D4B]">{body}</p>
    </div>
  );
}
