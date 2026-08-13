"use client";

import { useRouter } from "next/navigation";
import { NegotiationScreen } from "@/src/screens/NegotiationScreen";

export default function MatchingNegotiation() {
  const router = useRouter();
  return <NegotiationScreen onNavigate={(to) => router.push(to)} />;
}
