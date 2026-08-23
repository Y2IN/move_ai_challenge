import type { TrendPoint } from '../lib/history';

interface TrendChartProps {
  title: string;
  note: string;
  data: TrendPoint[];
  /** 값 뒤에 붙는 단위. '%' 또는 '만원' */
  suffix: string;
}

/** 분기 추이 막대 차트. 마지막(현재) 분기만 파란 강조 */
export function TrendChart({ title, note, data, suffix }: TrendChartProps) {
  // 전 분기 값이 전부 0이면 max 가 0 이 되어 height 가 NaN% 로 나가 막대가 통째로
  // 사라진다. 데이터가 없는 상태와 "높이 0" 은 화면에서 구분돼야 한다.
  const max = Math.max(0, ...data.map((d) => d.rate));
  const heightOf = (rate: number) => (max > 0 ? `${(rate / max) * 100}%` : '0%');

  return (
    <div className="flex h-full flex-col justify-between rounded-[20px] bg-white p-[26px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">{title}</span>
        <span className="text-[13px] text-[#8B95A1]">{note}</span>
      </div>

      <div className="mt-6 flex items-end gap-4">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2.5">
            <span
              className={`text-[15px] font-extrabold tabular-nums tracking-[-0.02em] ${
                d.current ? 'text-[#3182F6]' : 'text-[#B0B8C1]'
              }`}
            >
              {d.rate.toLocaleString()}
              {suffix}
            </span>

            <span className="flex h-[132px] w-full items-end">
              <span
                className={`block w-full rounded-t-lg ${d.current ? 'bg-[#3182F6]' : 'bg-[#E5E8EB]'}`}
                style={{ height: heightOf(d.rate) }}
              />
            </span>

            <span className={`text-xs ${d.current ? 'font-bold text-[#4E5968]' : 'text-[#B0B8C1]'}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
