"use client";

import { useRouter } from "next/navigation";
import { BenefitScreen } from "@/src/screens/BenefitScreen";

export default function Benefit() {
  const router = useRouter();
  return <BenefitScreen onNavigate={(to) => router.push(to)} />;
}
