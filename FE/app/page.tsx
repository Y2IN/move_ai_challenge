"use client";

import { useRouter } from "next/navigation";
import { HomeScreen } from "@/src/screens/HomeScreen";

export default function Home() {
  const router = useRouter();
  // ponytail: 아직 없는 화면(/freight/new 등)은 push 시 404. 화면 추가되면 그대로 동작한다.
  return <HomeScreen onNavigate={(to) => router.push(to)} />;
}
