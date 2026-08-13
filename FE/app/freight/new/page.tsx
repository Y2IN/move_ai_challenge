"use client";

import { useRouter } from "next/navigation";
import { FreightNewScreen } from "@/src/screens/FreightNewScreen";

export default function FreightNew() {
  const router = useRouter();
  return <FreightNewScreen onNavigate={(to) => router.push(to)} />;
}
