"use client";

import { useRouter } from "next/navigation";
import { UnmatchedScreen } from "@/src/screens/UnmatchedScreen";

export default function MatchingUnmatched() {
  const router = useRouter();
  return <UnmatchedScreen onNavigate={(to) => router.push(to)} />;
}
