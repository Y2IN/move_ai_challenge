"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDraftApplication } from "@/src/lib/subsidy";
import { ApplyIntroScreen } from "@/src/screens/ApplyIntroScreen";

/**
 * 06a 컨테이너.
 *
 * "보고서 초안 생성" 은 **빈 서식만** 발급하고(LLM 미사용, 즉시) 그 id 를 들고
 * 06b 로 넘어간다. 문단 작성은 06b 가 여는 SSE 스트림이 맡는다 — 여기서 문단까지
 * 만들면 06b 가 같은 문단을 다시 만들어 LLM 호출이 두 배가 된다.
 */
export default function SubsidyNew() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    createDraftApplication()
      .then((d) => router.push(`/subsidy/generating?id=${encodeURIComponent(d.applicationId)}`))
      .catch((e: Error) => {
        // 발급이 막히면 그 자리에 머문다. 06b 로 보내봐야 스트림이 열리지 않는다.
        setError(e.message);
        setBusy(false);
      });
  };

  return (
    <ApplyIntroScreen
      busy={busy}
      error={error}
      onStart={start}
      onNavigate={(to) => router.push(to)}
      onBack={() => router.back()}
    />
  );
}
