"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchEsgIndicators,
  generateEsgReport,
  periodToQuery,
  scope3ExportUrl,
  type EsgIndicatorsResponse,
  type EsgReport,
  type EsgSectionKey,
  type Scope3Format,
} from "@/src/lib/esg";
import { ApplyDoneScreen } from "@/src/screens/ApplyDoneScreen";

/**
 * 06c 컨테이너.
 *
 * - K-ESG 탭: #40(지표표)은 즉시, #41(문단)은 LLM 호출이라 뒤늦게 채워집니다.
 * - 사업계획서 탭(#31~#39)은 아직 목데이터입니다 — 리포트 모듈 연동 전.
 */
export default function SubsidyDone() {
  const [indicators, setIndicators] = useState<EsgIndicatorsResponse | null>(null);
  const [indicatorsError, setIndicatorsError] = useState<string | null>(null);
  const [report, setReport] = useState<EsgReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<EsgSectionKey[]>([]);

  const loadIndicators = useCallback(() => {
    setIndicators(null);
    setIndicatorsError(null);
    fetchEsgIndicators()
      .then(setIndicators)
      .catch((error: Error) => setIndicatorsError(error.message));
  }, []);

  /** 전체 생성 = 최초 로드이자 "전체 재생성". 문단 5개가 병렬로 생성됩니다. */
  const generateAll = useCallback(() => {
    setReport(null);
    setReportError(null);
    generateEsgReport({})
      .then(setReport)
      .catch((error: Error) => setReportError(error.message));
  }, []);

  const started = useRef(false);
  useEffect(() => {
    // StrictMode 는 dev 에서 이펙트를 두 번 돌립니다. #41 은 LLM 호출이라
    // 그대로 두면 문단 10개 값을 지불합니다.
    if (started.current) return;
    started.current = true;
    loadIndicators();
    generateAll();
  }, [loadIndicators, generateAll]);

  /**
   * 문단 하나만 재생성(↻). 응답에는 요청한 문단만 담겨 오므로 그 문단만 바꿔 끼웁니다.
   *
   * previous 로 나머지 문단을 왕복시키지 않습니다 — 서버는 클라이언트가 보낸 문단의
   * 출처를 `user`(보증 불가)로 내리는데, 우리는 서버가 준 원본을 그대로 들고 있으므로
   * 왕복 없이 유지하는 쪽이 배지도 정확하고 페이로드도 작습니다.
   */
  const regenerateSection = useCallback(
    (key: EsgSectionKey) => {
      if (!report) return;
      setBusyKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));

      generateEsgReport({ ...periodToQuery(report.period), sections: [key] })
        .then((partial) => {
          const next = partial.sections.find((s) => s.key === key);
          if (!next) throw new Error("응답에 요청한 문단이 없습니다.");
          setReport((prev) => {
            if (!prev) return prev;
            const sections = prev.sections.map((s) => (s.key === key ? next : s));
            return {
              ...prev,
              sections,
              generatedAt: partial.generatedAt,
              generation: {
                ...partial.generation,
                aiCount: sections.filter((s) => s.source === "ai").length,
                fallbackCount: sections.filter((s) => s.source === "fallback").length,
              },
            };
          });
        })
        .catch((error: Error) => {
          // 실패해도 기존 문단은 살아 있습니다. 경고 줄만 붙여 알립니다.
          // 반복 실패 시 같은 경고가 계속 쌓이지 않도록 이전 실패 경고는 교체합니다.
          const failPrefix = "재생성 실패 — ";
          setReport((prev) =>
            prev
              ? {
                  ...prev,
                  sections: prev.sections.map((s) =>
                    s.key === key
                      ? {
                          ...s,
                          warnings: [
                            ...s.warnings.filter((w) => !w.startsWith(failPrefix)),
                            `${failPrefix}${error.message} 기존 문단을 유지합니다.`,
                          ],
                        }
                      : s,
                  ),
                }
              : prev,
          );
        })
        .finally(() => setBusyKeys((prev) => prev.filter((k) => k !== key)));
    },
    [report],
  );

  const exportScope3 = useCallback(
    (format: Scope3Format) => {
      // 화면에 떠 있는 기간과 같은 데이터를 내보내도록 기간을 고정합니다.
      const query = indicators ? periodToQuery(indicators.period) : {};
      const url = scope3ExportUrl(format, query);
      if (format === "pdf") {
        window.open(url, "_blank"); // 인쇄용 HTML — 새 탭에서 인쇄 대화상자가 뜹니다
      } else {
        window.location.href = url; // attachment 다운로드
      }
    },
    [indicators],
  );

  return (
    <ApplyDoneScreen
      esg={{ indicators, indicatorsError, report, reportError, busyKeys }}
      onRegenerateSection={regenerateSection}
      onRegenerateAllEsg={generateAll}
      onRetryIndicators={loadIndicators}
      onExportScope3={exportScope3}
    />
  );
}
