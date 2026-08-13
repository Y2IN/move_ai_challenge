"use client";

import { useRouter } from "next/navigation";
import { DemoEntryScreen } from "@/src/screens/DemoEntryScreen";

export default function Demo() {
  const router = useRouter();
  return <DemoEntryScreen onEnter={() => router.push("/home")} onLogin={() => router.push("/login")} />;
}
