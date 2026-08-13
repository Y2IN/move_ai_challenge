"use client";

import { useRouter } from "next/navigation";
import { ConfirmedScreen } from "@/src/screens/ConfirmedScreen";

export default function MatchingConfirmed() {
  const router = useRouter();
  return <ConfirmedScreen onNavigate={(to) => router.push(to)} />;
}
