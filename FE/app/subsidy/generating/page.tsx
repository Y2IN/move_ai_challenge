"use client";

import { useRouter } from "next/navigation";
import { ApplyGeneratingScreen } from "@/src/screens/ApplyGeneratingScreen";

export default function SubsidyGenerating() {
  const router = useRouter();
  return <ApplyGeneratingScreen onNavigate={(to) => router.push(to)} onCancel={() => router.back()} />;
}
