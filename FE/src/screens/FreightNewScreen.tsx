import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Field, SelectField, TextField } from '../components/Field';
import {
  CORP_TYPES,
  FREIGHT_ITEMS,
  aiFilledFields,
  emptyForm,
  naturalPlaceholder,
  parsedForm,
  sideNote,
  type CorpType,
  type FreightField,
  type FreightForm,
  type FreightItem,
} from '../mocks/freight';

interface FreightNewScreenProps {
  onNavigate?: (to: string) => void;
  /** 시연용. true면 AI가 이미 채운 상태로 시작한다 */
  prefilled?: boolean;
}

/** 04a — 화물 등록 (자연어 입력 → 구조화 폼) */
export function FreightNewScreen({ onNavigate, prefilled = true }: FreightNewScreenProps) {
  const [natural, setNatural] = useState('');
  const [form, setForm] = useState<FreightForm>(prefilled ? parsedForm : emptyForm);
  const [aiFields, setAiFields] = useState<Set<FreightField>>(
    new Set(prefilled ? aiFilledFields : []),
  );

  /** 값이 바뀐 필드는 AI 배지를 뗀다 */
  const setField = <K extends FreightField>(key: K, value: FreightForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setAiFields((cur) => {
      if (!cur.has(key)) return cur;
      const next = new Set(cur);
      next.delete(key);
      return next;
    });
  };

  const runAiFill = () => {
    setForm(parsedForm);
    setAiFields(new Set(aiFilledFields));
  };

  const isAi = (key: FreightField) => aiFields.has(key);

  return (
    <AppLayout active="freight">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em] text-[#191F28]">화물 등록</h1>
        <p className="text-base text-[#6B7684]">운송 요청을 문장으로 적어주세요. AI가 항목을 채워 드립니다.</p>
      </header>

      <section className="grid grid-cols-[1fr_320px] items-start gap-4">
        <div className="flex flex-col gap-4">
          <div className="rounded-[20px] bg-white p-6">
            <div className="relative">
              <textarea
                value={natural}
                onChange={(e) => setNatural(e.target.value)}
                placeholder={naturalPlaceholder}
                className="h-[132px] w-full resize-none rounded-2xl border border-[#E5E8EB] bg-[#F9FAFB] p-5 text-[17px] leading-relaxed text-[#191F28] outline-none transition-colors focus:border-[#3182F6] focus:bg-white"
              />
              <button
                type="button"
                onClick={runAiFill}
                className="absolute bottom-3.5 right-3.5 h-11 rounded-xl bg-[#3182F6] px-[18px] text-[15px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
              >
                AI로 채우기
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[20px] bg-white p-6">
            <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#191F28]">운송 정보</span>

            <div className="grid grid-cols-2 gap-3.5">
              <Field label="출발지" ai={isAi('from')}>
                <TextField value={form.from} onChange={(v) => setField('from', v)} placeholder="울산 공장" />
              </Field>

              <Field label="도착지" ai={isAi('to')}>
                <TextField value={form.to} onChange={(v) => setField('to', v)} placeholder="의왕ICD" />
              </Field>

              <Field label="품목" ai={isAi('item')}>
                <SelectField<FreightItem>
                  value={form.item}
                  options={FREIGHT_ITEMS}
                  onChange={(v) => setField('item', v)}
                />
              </Field>

              <Field label="중량 (톤)" ai={isAi('tons')}>
                <TextField
                  type="number"
                  numeric
                  value={form.tons}
                  onChange={(v) => setField('tons', v)}
                  placeholder="1860"
                />
              </Field>

              <Field label="희망 출발일" ai={isAi('departDate')}>
                <TextField type="date" value={form.departDate} onChange={(v) => setField('departDate', v)} />
              </Field>

              <Field label="기업 구분" ai={isAi('corpType')}>
                <SelectField<CorpType>
                  value={form.corpType}
                  options={CORP_TYPES}
                  onChange={(v) => setField('corpType', v)}
                />
              </Field>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <button type="button" className="text-[15px] font-semibold text-[#3182F6]">
                엑셀로 여러 건 등록하기
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('/matching/unmatched')}
                className="h-14 rounded-[14px] bg-[#3182F6] px-7 text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA]"
              >
                AI 합적 매칭 요청
              </button>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3 rounded-[20px] bg-white p-6">
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#E8F3FF] text-base font-extrabold text-[#1B64DA]">
            ?
          </span>
          <span className="text-base font-bold tracking-[-0.02em] text-[#191F28]">{sideNote.title}</span>
          <p className="text-[15px] leading-relaxed text-[#6B7684]">{sideNote.body}</p>
        </aside>
      </section>
    </AppLayout>
  );
}
