"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  applicationExportUrl,
  createApplication,
  fetchApplication,
  fetchLatestApplication,
  regenerateAll,
  regenerateParagraph,
  type ApplicationPayload,
  type ParagraphKey,
  type SubsidyExportFormat,
} from "@/src/lib/subsidy";
import { toApplyDocView } from "@/src/lib/subsidy-view";
import { ApplyDoneScreen } from "@/src/screens/ApplyDoneScreen";

/**
 * 06c 컨테이너.
 *
 * - 사업계획서 탭: 초안이 이미 있으면 #34→#33 으로 재사용하고, 없을 때만 #31 로
 *   새로 만듭니다. #31 은 문단 6개를 LLM 으로 쓰기 때문에 재진입마다 부르면 안 됩니다.
 * - K-ESG 탭: #40(지표표)은 즉시, #41(문단)은 LLM 호출이라 뒤늦게 채워집니다.
 */
function SubsidyDoneInner() {
  // 06b 가 넘겨준 초안 id. 있으면 그걸 쓰고, 없을 때만 최근 초안을 찾는다.
  const requestedId = useSearchParams().get("id");

  const [indicators, setIndicators] = useState<EsgIndicatorsResponse | null>(null);
  const [indicatorsError, setIndicatorsError] = useState<string | null>(null);
  const [report, setReport] = useState<EsgReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<EsgSectionKey[]>([]);

  // ── 사업계획서 탭 (#31·#33~#36·#39) ──────────────────────────
  const [application, setApplication] = useState<ApplicationPayload | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [docBusyKeys, setDocBusyKeys] = useState<ParagraphKey[]>([]);
  const [docRegenerating, setDocRegenerating] = useState(false);
  const [keptUserEdits, setKeptUserEdits] = useState<ParagraphKey[]>([]);
  const applicationId = application?.applicationId ?? null;

  /**
   * 초안이 있으면 그대로 가져오고(#34→#33), 없을 때만 새로 만듭니다(#31).
   * 조회는 LLM 을 타지 않으므로 재진입이 싸집니다.
   */
  const loadDoc = useCallback(() => {
    setApplication(null);
    setDocError(null);
    setKeptUserEdits([]);

    // 06b 에서 넘어온 경우: 그 초안을 그대로 연다. 스트림이 이미 문단을 채워 뒀다.
    const resolve = requestedId
      ? fetchApplication(requestedId)
      : fetchLatestApplication().then((latest) =>
          latest.exists && latest.applicationId
            ? fetchApplication(latest.applicationId)
            : createApplication(),
        );

    resolve
      .then((app) => {
        setApplication(app);
        // 06b 를 건너뛰고 들어와 문단이 비어 있으면(pending) 여기서 채운다.
        // 06b 를 정상으로 거쳤다면 이 경로는 타지 않는다.
        const empty = Object.values(app.document.paragraphs).every(
          (para) => !para || para.source === "pending" || !para.text,
        );
        if (empty) regenerateAll(app.applicationId).then((r) =>
          setApplication((prev) => (prev ? { ...prev, document: r.document } : prev)),
        ).catch(() => { /* 실패해도 빈 서식은 이미 떠 있다 */ });
      })
      .catch((error: Error) => setDocError(error.message));
  }, [requestedId]);

  /** #36 문단 하나만 재생성(↻). 응답 문단만 갈아 끼웁니다. */
  const regenerateDocParagraph = useCallback(
    (key: ParagraphKey) => {
      if (!applicationId) return;
      setDocBusyKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setDocError(null);

      regenerateParagraph(applicationId, key)
        .then((res) => {
          setApplication((prev) =>
            prev
              ? {
                  ...prev,
                  document: {
                    ...prev.document,
                    paragraphs: { ...prev.document.paragraphs, [key]: res.paragraph },
                  },
                }
              : prev,
          );
        })
        // 실패해도 기존 문서는 그대로 둡니다 — 배너로만 알립니다.
        .catch((error: Error) => setDocError(`문단 재생성 실패 — ${error.message}`))
        .finally(() => setDocBusyKeys((prev) => prev.filter((k) => k !== key)));
    },
    [applicationId],
  );

  /** #35 전체 재생성. 사용자가 편집한 문단은 서버가 보존하고 목록으로 알려줍니다. */
  const regenerateAllDoc = useCallback(() => {
    if (!applicationId) return;
    setDocRegenerating(true);
    setDocError(null);

    regenerateAll(applicationId)
      .then((res) => {
        setApplication((prev) =>
          prev ? { ...prev, document: res.document, diagnostics: res.diagnostics } : prev,
        );
        setKeptUserEdits(res.keptUserEdits);
      })
      .catch((error: Error) => setDocError(`전체 재생성 실패 — ${error.message}`))
      .finally(() => setDocRegenerating(false));
  }, [applicationId]);

  /** #39 내보내기. 인쇄용 HTML 이라 새 탭에서 인쇄 대화상자가 뜹니다. */
  const exportDoc = useCallback(
    (format: SubsidyExportFormat) => {
      if (!applicationId) return;
      window.open(applicationExportUrl(applicationId, format), "_blank");
    },
    [applicationId],
  );

  // 숫자를 서식 표기로 옮기는 건 순수 변환이라 문서가 바뀔 때만 다시 합니다.
  const docView = useMemo(
    () => (application ? toApplyDocView(application.document) : null),
    [application],
  );

  const loadIndicators = useCallback(() => {
    setIndicators(null);
    setIndicatorsError(null);
    fetchEsgIndicators()
      .then(setIndicators)
      .catch((error: Error) => setIndicatorsError(error.message));
  }, []);

  /**
   * 폴백 초안 회전 인덱스. 재생성할 때마다 1씩 올려 서버로 보냅니다.
   *
   * 서버가 이 카운터를 들고 있으면 안 됩니다 — 서버리스에서는 콜드 스타트마다 리셋되어
   * 재생성을 눌러도 같은 문장이 다시 나옵니다. DB(Supabase)에 넣는 것도 과합니다.
   * 데모 문장 하나 고르자고 재생성마다 쓰기가 한 번씩 발생하니까요.
   *
   * "지금 몇 번째 초안을 보고 있는가"는 화면의 상태이므로 화면이 셉니다. 단조 증가라
   * 인스턴스가 몇 개든, 같은 문단을 연속으로 눌러도 매번 다음 초안이 나옵니다.
   * (렌더에 영향을 주지 않는 값이라 state 가 아니라 ref 입니다)
   */
  const draftSeed = useRef(0);
  const nextDraftSeed = useCallback(() => (draftSeed.current += 1), []);

  /** 전체 생성 = 최초 로드이자 "전체 재생성". 문단 5개가 병렬로 생성됩니다. */
  const generateAll = useCallback(() => {
    setReport(null);
    setReportError(null);
    generateEsgReport({ draftSeed: nextDraftSeed() })
      .then(setReport)
      .catch((error: Error) => setReportError(error.message));
  }, [nextDraftSeed]);

  const started = useRef(false);
  useEffect(() => {
    // StrictMode 는 dev 에서 이펙트를 두 번 돌립니다. #41 은 LLM 호출이라
    // 그대로 두면 문단 10개 값을 지불합니다.
    if (started.current) return;
    started.current = true;
    loadDoc();
    loadIndicators();
    generateAll();
  }, [loadDoc, loadIndicators, generateAll]);

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

      generateEsgReport({
        ...periodToQuery(report.period),
        sections: [key],
        draftSeed: nextDraftSeed(),
      })
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
    [report, nextDraftSeed],
  );

  /**
   * 문단 직접 편집(✎). 담당자가 사내 문체로 손보는 자리입니다.
   *
   * **출처를 `user` 로 내립니다.** 사람이 고쳐 쓴 문장이 "AI 서술 · 숫자 검증 통과"
   * 파란 배지를 달고 있으면 안 됩니다 — 그 배지는 서버 검출기를 통과했다는 뜻인데,
   * 편집분은 통과한 적이 없습니다. 서버가 `previous` 로 받은 문단을 `user` 로 내리는
   * 것과 같은 이유이고, 같은 배지("검증 필요")로 표시됩니다.
   *
   * 편집분은 서버로 보내지 않습니다. 이 시점에 필요한 건 저장이 아니라 화면 반영이고,
   * 왕복시키면 문단이 다시 생성 경로를 타 방금 쓴 문장이 날아갑니다.
   */
  const editSection = useCallback((key: EsgSectionKey, text: string) => {
    setReport((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((s) =>
        s.key === key
          ? {
              ...s,
              text,
              source: "user" as const,
              warnings: ["직접 편집한 문단입니다. 숫자 검증을 다시 받지 않았습니다."],
            }
          : s,
      );
      return {
        ...prev,
        sections,
        generation: {
          ...prev.generation,
          aiCount: sections.filter((s) => s.source === "ai").length,
          fallbackCount: sections.filter((s) => s.source === "fallback").length,
        },
      };
    });
  }, []);

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
      doc={{
        applicationId,
        doc: docView,
        error: docError,
        busyKeys: docBusyKeys,
        regenerating: docRegenerating,
        inputOrigin: application?.inputOrigin ?? null,
        inputNote: application?.inputNote ?? null,
        keptUserEdits,
      }}
      onRegenerateParagraph={regenerateDocParagraph}
      onRegenerateAllDoc={regenerateAllDoc}
      onRetryDoc={loadDoc}
      onExportDoc={exportDoc}
      esg={{ indicators, indicatorsError, report, reportError, busyKeys }}
      onRegenerateSection={regenerateSection}
      onEditSection={editSection}
      onRegenerateAllEsg={generateAll}
      onRetryIndicators={loadIndicators}
      onExportScope3={exportScope3}
    />
  );
}

export default function SubsidyDone() {
  // useSearchParams 는 Suspense 경계가 필요하다 (없으면 빌드가 정적 생성에서 막힌다).
  return (
    <Suspense fallback={null}>
      <SubsidyDoneInner />
    </Suspense>
  );
}
