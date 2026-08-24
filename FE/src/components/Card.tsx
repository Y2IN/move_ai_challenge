import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[20px] bg-white p-[26px] ${className}`}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">{children}</span>;
}

/** 화면 상단 결과 배너 */
export function Banner({
  tone,
  children,
}: {
  tone: 'info' | 'warn';
  children: ReactNode;
}) {
  const warn = tone === 'warn';
  return (
    <div className={`flex items-center gap-3.5 rounded-2xl px-6 py-5 ${warn ? 'bg-[#FFF4E0]' : 'bg-[#E8F3FF]'}`}>
      <span
        className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-extrabold text-white ${
          warn ? 'bg-[#F59E0B]' : 'bg-[#3182F6]'
        }`}
      >
        {warn ? '!' : '✓'}
      </span>
      <span className={`text-[17px] font-bold tracking-[-0.02em] ${warn ? 'text-[#B45309]' : 'text-[#1B64DA]'}`}>
        {children}
      </span>
    </div>
  );
}

/** 라벨 위 · 값 아래 형태의 정보 셀 */
export function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] text-[#8B95A1]">{label}</div>
      <div className="mt-1.5 text-[17px] font-bold tabular-nums tracking-[-0.02em] text-[#191F28]">{value}</div>
    </div>
  );
}

/** 공차 회송 구간 카드. 04c · 04e 공용 */
export function WagonRouteCard({
  route,
  departLabel,
  departAt,
  third,
  fourth,
}: {
  route: string;
  departLabel: string;
  departAt: string;
  third: { label: string; value: string };
  fourth: { label: string; value: string };
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>배정된 공차 노선</CardTitle>
        <span className="rounded-lg bg-[#EAF8F1] px-[11px] py-1.5 text-[13px] font-bold text-[#12A87A]">
          공차 회송 구간
        </span>
      </div>
      <div className="mt-[18px] grid grid-cols-2 gap-4 lg:grid-cols-4">
        <InfoCell label="구간" value={route} />
        <InfoCell label={departLabel} value={departAt} />
        <InfoCell label={third.label} value={third.value} />
        <InfoCell label={fourth.label} value={fourth.value} />
      </div>
    </Card>
  );
}
