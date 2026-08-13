'use client';

import { useCallback, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ErrorNotice } from '../components/AsyncSection';
import { ChoiceField, Field, SelectField, TextField } from '../components/Field';
import { setShipment } from '../lib/demo-session';
import {
  CORP_TYPES,
  FREIGHT_ITEMS,
  TRANSPORT_MODES,
  applyParsed,
  emptyForm,
  fetchParseCases,
  fetchStations,
  parseFreight,
  registerFreight,
  requestMatching,
  toShipmentInput,
  validateForm,
  type CorpType,
  type FreightField,
  type FreightForm,
  type StationOption,
  type TransportMode,
} from '../lib/freight';
import { useAsync } from '../lib/use-async';
import type { ItemCategory } from '@railhub/be/types';

interface FreightNewScreenProps {
  onNavigate?: (to: string) => void;
}

interface Masters {
  stations: StationOption[];
  cases: { id: string; label: string; text: string }[];
  notice: string;
}

/**
 * 04a — 화물 등록 (자연어 입력 → 구조화 폼 → 매칭 요청).
 *
 * 세 번의 호출이 한 줄기로 이어집니다.
 *   #10 파싱   문장 → 폼 (AI 배지는 **실제로 값이 온 필드에만** 붙습니다)
 *   #11 등록   폼 → 화물
 *   #16 매칭   편성 성립이면 확정 화면, 미달이면 조율 화면으로
 */
export function FreightNewScreen({ onNavigate }: FreightNewScreenProps) {
  const [natural, setNatural] = useState('');
  const [form, setForm] = useState<FreightForm>(emptyForm);
  const [aiFields, setAiFields] = useState<Set<FreightField>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [parsing, setParsing] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** 역 마스터와 예시 문장은 화면 진입 때 한 번만 받습니다. */
  const masters = useAsync<Masters>(
    useCallback(
      () =>
        Promise.all([fetchStations(), fetchParseCases()]).then(([s, p]) => ({
          stations: s.items,
          cases: p.cases,
          notice: p.notice,
        })),
      [],
    ),
  );
  const stations = masters.state.status === 'ready' ? masters.state.data.stations : [];
  const stationOptions = stations.map((s) => ({ value: s.id, label: `${s.name} (${s.region})` }));

  /** 값이 바뀐 필드는 AI 배지를 뗀다 */
  const setField = <K extends FreightField>(key: K, value: FreightForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors(({ [key]: _removed, ...rest }) => rest);
    setAiFields((cur) => {
      if (!cur.has(key)) return cur;
      const next = new Set(cur);
      next.delete(key);
      return next;
    });
  };

  /** #10 — 문장을 서버로 보내 폼을 채웁니다. 못 맞춘 필드는 비워 두고 배지도 안 붙입니다. */
  const runAiFill = () => {
    if (!natural.trim() || parsing) return;
    setParsing(true);
    setSubmitError(null);

    parseFreight(natural)
      .then((res) => {
        const { form: next, aiFields: filled } = applyParsed(res.fields, stations, form);
        setForm(next);
        setAiFields(new Set(filled));
        setErrors({});

        // 서버가 못 채운 필드가 있으면 그 사실을 그대로 알립니다.
        const missing = (['originStationId', 'destStationId', 'tons', 'departDate'] as const).filter(
          (k) => !filled.includes(k),
        );
        setParseWarnings([
          ...res.warnings,
          ...(missing.length ? ['직접 채워야 하는 항목이 있습니다 — 아래 폼을 확인하세요.'] : []),
        ]);
      })
      .catch((error: Error) => setSubmitError(`파싱 실패 — ${error.message}`))
      .finally(() => setParsing(false));
  };

  /** #11 등록 → #16 매칭. 편성 성립 여부에 따라 다음 화면이 갈립니다. */
  const submit = () => {
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    const input = toShipmentInput(form, 'embark');

    registerFreight(input)
      .then(() => {
        // 다음 화면들이 같은 화물로 이어지도록 들고 갑니다 (인증이 없어 서버가 못 찾습니다).
        setShipment(input);
        return requestMatching(input);
      })
      .then((result) => {
        onNavigate?.(result.status === 'matched' ? '/matching/confirmed' : '/matching/unmatched');
      })
      .catch((error: Error) => {
        setSubmitError(error.message);
        setSubmitting(false);
      });
  };

  return (
    <AppLayout active="freight">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">화물 등록</h1>
        <p className="text-base text-[#6B7684]">운송 요청을 문장으로 적어주세요. AI가 항목을 채워 드립니다.</p>
      </header>

      <section className="grid grid-cols-[1fr_320px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <div className="flex flex-col gap-3">
              <textarea
                value={natural}
                onChange={(e) => setNatural(e.target.value)}
                placeholder="울산 공장에서 경기 물류센터까지 석유화학제품 8톤, 다음주 화요일 출발"
                className="h-[132px] w-full resize-none rounded-2xl border border-[#E5E8EB] bg-[#F9FAFB] p-5 text-[17px] leading-relaxed text-[#191F28] outline-none transition-colors focus:border-[#3182F6] focus:bg-white"
              />

              {/* 예시 문장은 서버(#10 GET)가 주는 케이스 목록입니다 */}
              {masters.state.status === 'ready' && (
                <div className="flex flex-wrap items-center gap-2">
                  {masters.state.data.cases.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNatural(c.text)}
                      className="rounded-lg bg-[#F2F4F6] px-3 py-2 text-[13px] font-semibold text-[#4E5968] transition-colors hover:bg-[#E5E8EB]"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] leading-relaxed text-[#8B95A1]">
                  {masters.state.status === 'ready' ? masters.state.data.notice : ' '}
                </span>
                <button
                  type="button"
                  onClick={runAiFill}
                  disabled={parsing || !natural.trim()}
                  className="h-14 shrink-0 rounded-[14px] bg-[#3182F6] px-7 text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] disabled:bg-[#B0B8C1]"
                >
                  {parsing ? '읽는 중…' : 'AI로 채우기'}
                </button>
              </div>

              {parseWarnings.map((w) => (
                <span key={w} className="text-[13px] font-semibold text-[#C77700]">
                  {w}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[20px] bg-white p-6">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">운송 정보</span>

            <div className="grid grid-cols-2 gap-3.5">
              <Field label="출발역" ai={aiFields.has('originStationId')} error={errors.originStationId}>
                <ChoiceField
                  value={form.originStationId}
                  options={stationOptions}
                  disabled={!stationOptions.length}
                  placeholder={stationOptions.length ? '출발역 선택' : '역 목록을 불러오는 중…'}
                  onChange={(v) => setField('originStationId', v)}
                />
              </Field>

              <Field label="도착역" ai={aiFields.has('destStationId')} error={errors.destStationId}>
                <ChoiceField
                  value={form.destStationId}
                  options={stationOptions}
                  disabled={!stationOptions.length}
                  placeholder={stationOptions.length ? '도착역 선택' : '역 목록을 불러오는 중…'}
                  onChange={(v) => setField('destStationId', v)}
                />
              </Field>

              <Field label="품목" ai={aiFields.has('item')}>
                <SelectField<ItemCategory>
                  value={form.item}
                  options={FREIGHT_ITEMS}
                  onChange={(v) => setField('item', v)}
                />
              </Field>

              <Field label="중량 (톤)" ai={aiFields.has('tons')} error={errors.tons}>
                <TextField
                  type="number"
                  numeric
                  value={form.tons}
                  onChange={(v) => setField('tons', v)}
                  placeholder="8"
                />
              </Field>

              <Field label="희망 출발일" ai={aiFields.has('departDate')} error={errors.departDate}>
                <TextField type="date" value={form.departDate} onChange={(v) => setField('departDate', v)} />
              </Field>

              <Field label="기업 구분">
                <SelectField<CorpType>
                  value={form.corpType}
                  options={CORP_TYPES}
                  onChange={(v) => setField('corpType', v)}
                />
              </Field>

              <Field label="운송 방식">
                <SelectField<TransportMode>
                  value={form.transportMode}
                  options={TRANSPORT_MODES}
                  onChange={(v) => setField('transportMode', v)}
                />
              </Field>
            </div>

            {/* 조율 에이전트(#22)가 읽는 입력. 여기 적은 문장이 절대 조건/조정 가능으로 나뉩니다 */}
            <Field label="조건 · 요청사항 (선택)">
              <textarea
                value={form.constraintText}
                onChange={(e) => setField('constraintText', e.target.value)}
                placeholder="22일까지 도착이면 됩니다. 창고 공간은 여유 있어요"
                className="h-[84px] w-full resize-none rounded-xl border border-[#E5E8EB] bg-white p-4 text-base leading-relaxed text-[#191F28] outline-none transition-colors focus:border-[#3182F6]"
              />
            </Field>

            {submitError && <ErrorNotice message={submitError} />}

            <div className="mt-1 flex items-center justify-between">
              <span className="text-[13px] text-[#8B95A1]">
                등록하면 시드 화물 풀과 함께 편성을 계산합니다.
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="h-14 rounded-[14px] bg-[#3182F6] px-7 text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] disabled:bg-[#B0B8C1]"
              >
                {submitting ? '매칭하는 중…' : 'AI 합적 매칭 요청'}
              </button>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3 rounded-[20px] bg-white p-6">
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#E8F3FF] text-base font-extrabold text-[#1B64DA]">
            ?
          </span>
          <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">소량 화물도 괜찮습니다</span>
          <p className="text-[15px] leading-relaxed text-[#6B7684]">
            단독으로 화차를 채우지 못하는 소량 화물도 등록할 수 있습니다. 동일 노선 화주와 자동으로 묶입니다.
          </p>
          {masters.state.status === 'error' && (
            <ErrorNotice message={masters.state.message} onRetry={masters.reload} />
          )}
        </aside>
      </section>
    </AppLayout>
  );
}
