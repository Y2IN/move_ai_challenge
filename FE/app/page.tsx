"use client";

import { useRouter } from "next/navigation";
import { LandingScreen } from "@/src/screens/LandingScreen";

export default function Landing() {
  const router = useRouter();
  return <LandingScreen onLogin={() => router.push("/login")} onStart={() => router.push("/demo")} />;
}
