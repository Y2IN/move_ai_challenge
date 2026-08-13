"use client";

import { useRouter } from "next/navigation";
import { ApplyIntroScreen } from "@/src/screens/ApplyIntroScreen";

export default function SubsidyNew() {
  const router = useRouter();
  return <ApplyIntroScreen onNavigate={(to) => router.push(to)} onBack={() => router.back()} />;
}
