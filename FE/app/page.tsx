"use client";

import { useRouter } from "next/navigation";
import { LandingScreen } from "@/src/screens/LandingScreen";

export default function Landing() {
  const router = useRouter();
  // ponytail: 문의(onContact)는 받을 곳이 없어 미연결. 폼/메일 정해지면 붙인다.
  return <LandingScreen onLogin={() => router.push("/login")} onStart={() => router.push("/demo")} />;
}
