import type { StatData } from '../mocks/home';

export function StatCard({ stat }: { stat: StatData }) {
  return (
    <div className="rounded-[18px] bg-white px-6 py-[22px]">
      <div className="text-[15px] font-semibold text-[#6B7684]">{stat.label}</div>
      <div className="mt-2.5 text-[28px] font-extrabold tracking-[-0.03em] text-[#191F28]">{stat.value}</div>
      <div
        className={`mt-1.5 text-sm font-semibold ${stat.deltaTone === 'up' ? 'text-[#12A87A]' : 'text-[#6B7684]'}`}
      >
        {stat.delta}
      </div>
    </div>
  );
}

/** 비유 카드 (소나무 / 트럭) */
export function AnalogyCard({
  value,
  label,
  tone = 'plain',
}: {
  value: string;
  label: string;
  tone?: 'green' | 'plain';
}) {
  const green = tone === 'green';
  return (
    <div
      className={`flex flex-1 items-center gap-3.5 rounded-[18px] px-6 py-5 ${green ? 'bg-[#EAF8F1]' : 'bg-white'}`}
    >
      <span
        className={`text-[28px] font-extrabold tracking-[-0.03em] ${green ? 'text-[#0F7A5A]' : 'text-[#191F28]'}`}
      >
        {value}
      </span>
      <span className={`text-[15px] font-semibold ${green ? 'text-[#12A87A]' : 'text-[#6B7684]'}`}>{label}</span>
    </div>
  );
}
