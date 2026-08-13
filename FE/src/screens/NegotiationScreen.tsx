import { AppLayout } from '../components/AppLayout';
import {
  gauge,
  negoMeta,
  negoSteps,
  shipperProfiles,
  wagon,
  type NegoStep,
  type ShipperProfile,
  type StepStatus,
} from '../mocks/negotiation';

const TRAIT_CLASS: Record<ShipperProfile['traitTone'], string> = {
  none: 'bg-[#EAF8F1] text-[#12A87A]',
  active: 'bg-[#E8F3FF] text-[#1B64DA]',
  rigid: 'bg-[#F2F4F6] text-[#6B7684]',
};

const STATUS_CLASS: Record<StepStatus, string> = {
  accepted: 'bg-[#EAF8F1] text-[#12A87A]',
  conditional: 'bg-[#FFF4E0] text-[#C77700]',
  rejected: 'bg-[#F2F4F6] text-[#6B7684]',
};

const MARK_CLASS: Record<StepStatus, string> = {
  accepted: 'bg-[#15C47E] text-white',
  conditional: 'bg-[#FFF4E0] text-[#C77700]',
  rejected: 'bg-[#F2F4F6] text-[#8B95A1]',
};

const MARK_GLYPH: Record<StepStatus, string> = {
  accepted: '✓',
  conditional: '~',
  rejected: '✕',
};

function ShipperCard({ profile }: { profile: ShipperProfile }) {
  return (
    <div
      className={[
        'rounded-[14px] border px-4 py-3.5',
        profile.excluded ? 'border-[#E5E8EB] bg-white opacity-[0.72]' : 'border-[#F2F4F6] bg-[#F9FAFB]',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">
          {profile.name}{' '}
          <span className="text-sm font-semibold tabular-nums text-[#8B95A1]">{profile.tons}</span>
        </span>
        <span className={`whitespace-nowrap rounded-md px-[9px] py-1 text-xs font-bold ${TRAIT_CLASS[profile.traitTone]}`}>
          {profile.trait}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[#6B7684]">{profile.quote}</p>

      {profile.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {profile.tags.map((t) => (
            <span
              key={t.label}
              className={`rounded-md px-[9px] py-1 text-xs font-semibold ${
                t.kind === 'absolute' ? 'bg-[#F2F4F6] text-[#4E5968]' : 'bg-[#E8F3FF] text-[#1B64DA]'
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepItem({ step }: { step: NegoStep }) {
  const muted = step.status === 'rejected';
  return (
    <div className="grid grid-cols-[22px_1fr] gap-3">
      <span
        className={`mt-0.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-extrabold ${
          MARK_CLASS[step.status]
        }`}
      >
        {MARK_GLYPH[step.status]}
      </span>

      <div>
        <div className="flex items-baseline gap-2">
          <span className={`text-[15px] font-bold ${muted ? 'text-[#6B7684]' : 'text-[#191F28]'}`}>
            {step.title}
          </span>
          <span className={`whitespace-nowrap rounded-md px-2 py-[3px] text-xs font-bold ${STATUS_CLASS[step.status]}`}>
            {step.statusLabel}
          </span>
          {step.saving && (
            <span className="ml-auto whitespace-nowrap text-[13px] tabular-nums text-[#B0B8C1]">{step.saving}</span>
          )}
        </div>

        {step.message && (
          <div className="relative mt-1.5 rounded-[10px] border border-[#D6E7FF] bg-[#F5F9FF] px-3.5 py-3">
            <p className="text-[13px] leading-[1.7] text-[#333D4B]">{step.message}</p>
            <span className="absolute -bottom-2 left-3.5 rounded-md bg-[#D6E7FF] px-2 py-0.5 text-[11px] font-bold text-[#1B64DA]">
              AI 서술 · 화주 발송용
            </span>
          </div>
        )}

        {step.note && (
          <div className={`text-[13px] text-[#8B95A1] ${step.message ? 'mt-3' : 'mt-1'}`}>{step.note}</div>
        )}
      </div>
    </div>
  );
}

interface NegotiationScreenProps {
  onNavigate?: (to: string) => void;
}

/** 04d — 조율 진행. 좌우 패널은 내용만큼 늘고, 내용 많은 쪽 높이에 서로 맞춘다 */
export function NegotiationScreen({ onNavigate }: NegotiationScreenProps) {
  return (
    <AppLayout active="matching">
      <section className="rounded-[20px] bg-white px-[26px] py-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#191F28]">
            조율 진행 중 · {wagon.route}
          </span>
          <span className="flex items-baseline gap-2.5">
            <span className="text-sm text-[#8B95A1]">적재율</span>
            <span className="text-[15px] tabular-nums text-[#B0B8C1] line-through">{gauge.start}%</span>
            <span className="text-[15px] tabular-nums text-[#B0B8C1]">→ {gauge.mid}%</span>
            <span className="text-3xl font-extrabold tabular-nums tracking-[-0.035em] text-[#191F28]">
              {gauge.end}%
            </span>
          </span>
        </div>

        <span className="relative mt-3 block h-3 overflow-hidden rounded-full bg-[#F2F4F6]">
          <span className="absolute left-0 top-0 h-3 rounded-full bg-[#15C47E]" style={{ width: `${gauge.end}%` }} />
          <span className="absolute left-0 top-0 h-3 rounded-full bg-[#3182F6]" style={{ width: `${gauge.mid}%` }} />
          <span
            className="absolute left-0 top-0 h-3 rounded-full bg-[#191F28]"
            style={{ width: `${gauge.start}%` }}
          />
          <span className="absolute top-0 h-3 w-0.5 bg-white" style={{ left: `${gauge.minRate}%` }} />
        </span>

        <div className="mt-2 flex gap-5 text-[13px] text-[#8B95A1]">
          <span>
            <b className="text-[#191F28]">{gauge.start}%</b> {gauge.startLabel}
          </span>
          <span>
            <b className="text-[#3182F6]">{gauge.mid}%</b> {gauge.midLabel}
          </span>
          <span>
            <b className="text-[#12A87A]">{gauge.end}%</b> {gauge.endLabel}
          </span>
          <span className="ml-auto text-[#B0B8C1]">최소 기준 {gauge.minRate}%</span>
        </div>
      </section>

      {/* items-start 없이 stretch — 두 패널이 내용 많은 쪽 높이에 맞춰 함께 늘어난다 */}
      <section className="grid grid-cols-[480px_1fr] gap-4">
        <div className="flex flex-col gap-3 rounded-[20px] bg-white px-6 py-[22px]">
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">화주 제약 분류</span>
          <div className="flex flex-col gap-2.5">
            {shipperProfiles.map((p) => (
              <ShipperCard key={p.name} profile={p} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] bg-white px-6 py-[22px]">
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">협상 타임라인</span>
            <span className="text-sm text-[#8B95A1]">{negoMeta.retries}</span>
          </div>

          <div className="flex flex-1 flex-col gap-2.5">
            {negoSteps.map((s) => (
              <StepItem key={s.id} step={s} />
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#F2F4F6] pt-3">
            <span className="text-sm text-[#8B95A1]">{negoMeta.summary}</span>
            <button
              type="button"
              onClick={() => onNavigate?.('/matching/confirmed')}
              className="h-12 rounded-xl bg-[#3182F6] px-[22px] text-base font-bold text-white transition-colors hover:bg-[#1B64DA]"
            >
              편성 확정하기
            </button>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
