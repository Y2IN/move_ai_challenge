"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createDraftApplication,
  streamApplication,
  type StreamStep,
} from "@/src/lib/subsidy";
import type { GenerateStep } from "@/src/mocks/apply";
import {
  ApplyGeneratingScreen,
  type GenerateProgress,
} from "@/src/screens/ApplyGeneratingScreen";

/**
 * 06b 컨테이너 — 진행률을 **실제로** 받아 그린다.
 *
 * 흐름: 06a 가 `?id=APP-xxxx` 를 달아 보낸다 → 그 초안의 SSE 스트림을 연다 →
 * 서버가 계산 4단계를 확인해 보내고, 5단계에서 문단 6개를 만들며 진행률을 흘린다 →
 * `done` 이 오면 06c 로 같은 id 를 들고 넘어간다.
 *
 * ⚠️ **스트림이 문단을 만든다.** 그래서 이 화면을 건너뛰면 문단이 안 채워진다
 *    (06c 가 pending 서식을 보고 스스로 생성하도록 되어 있으니 화면은 깨지지 않는다).
 *    반대로 스트림을 두 번 열면 문단도 두 번 만들어진다 — StrictMode 이중 실행과
 *    EventSource 자동 재연결을 아래에서 각각 막는다.
 */
function SubsidyGeneratingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const idFromQuery = params.get("id");

  const [steps, setSteps] = useState<StreamStep[]>([]);
  const [paragraph, setParagraph] = useState<{ done: number; total: number } | null>(null);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [appId, setAppId] = useState<string | null>(idFromQuery);

  /**
   * 개발 모드의 StrictMode 는 effect 를 두 번 실행한다. 그대로 두면 문단 생성이
   * 두 번 돌아 무료 티어 분당 한도를 그 자리에서 넘긴다. 한 번만 돌게 막는다.
   */
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let stop: (() => void) | null = null;
    let cancelled = false;

    const open = (id: string) => {
      if (cancelled) return;
      setAppId(id);
      stop = streamApplication(id, {
        onStep: (s) =>
          setSteps((prev) => {
            const i = prev.findIndex((p) => p.step === s.step);
            if (i === -1) return [...prev, s];
            const next = [...prev];
            next[i] = s;
            return next;
          }),
        onParagraph: (d) => {
          setParagraph({ done: d.done, total: d.total });
          setPercent(d.progress);
        },
        onDone: () => {
          setPercent(100);
          setFinished(true);
          // 결과를 바로 보여준다. 사용자가 "완료 화면 보기" 를 누를 필요 없다.
          router.replace(`/subsidy/done?id=${encodeURIComponent(id)}`);
        },
        onError: (message) => setError(message),
      });
    };

    if (idFromQuery) {
      open(idFromQuery);
    } else {
      // 06a 를 거치지 않고 이 주소로 바로 들어온 경우 (새로고침·북마크).
      // 빈 서식을 즉석에서 발급해 스트림을 연다.
      createDraftApplication()
        .then((d) => open(d.applicationId))
        .catch((e: Error) => setError(e.message));
    }

    // 서버가 아무 이벤트도 안 보내면 화면은 "1/5 · 0%" 빈 카드에 영원히 머문다.
    // 15초 안에 첫 이벤트가 없으면 에러로 전환해 사용자가 다시 시도할 수 있게 한다.
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setSteps((prev) => {
        if (prev.length === 0) {
          setError("생성 진행 상황이 오지 않습니다. 다시 시도해 주세요.");
          stop?.();
        }
        return prev;
      });
    }, 15_000);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      stop?.();
    };
  }, [idFromQuery, router]);

  /** 서버 이벤트를 화면이 쓰는 모양으로 옮긴다. */
  const viewSteps = useMemo<GenerateStep[]>(() => {
    const rows: GenerateStep[] = steps
      .slice()
      .sort((a, b) => a.step - b.step)
      .map((s) => ({
        label: s.label,
        result: s.detail ?? "",
        done: s.status === "done",
        ai: s.step === 5,
      }));

    // 5단계(AI)는 문단 진행 상황을 곁들인다.
    const ai = rows.find((r) => r.ai);
    if (ai && !ai.done) {
      ai.label = "서술 문단 작성 중";
      ai.result = paragraph
        ? `${paragraph.total}개 문단 중 ${paragraph.done}번째`
        : ai.result || "시작하는 중";
    }
    return rows;
  }, [steps, paragraph]);

  const progress = useMemo<GenerateProgress>(() => {
    const total = 5;
    const doneCount = viewSteps.filter((s) => s.done).length;
    return {
      current: Math.min(doneCount + (finished ? 0 : 1), total),
      total,
      // 계산 4단계는 각 20%, 문단 진행률은 서버가 계산해 보내준다.
      percent: percent || Math.round((doneCount / total) * 100),
    };
  }, [viewSteps, percent, finished]);

  return (
    <ApplyGeneratingScreen
      steps={viewSteps}
      progress={progress}
      error={error}
      finished={finished}
      onViewResult={() =>
        router.replace(appId ? `/subsidy/done?id=${encodeURIComponent(appId)}` : "/subsidy/done")
      }
      onCancel={() => router.push("/subsidy/new")}
    />
  );
}

export default function SubsidyGenerating() {
  // useSearchParams 는 Suspense 경계가 필요하다 (없으면 빌드가 정적 생성에서 막힌다).
  return (
    <Suspense fallback={null}>
      <SubsidyGeneratingInner />
    </Suspense>
  );
}
