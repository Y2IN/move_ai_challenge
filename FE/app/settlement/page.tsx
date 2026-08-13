"use client";

import { useRouter } from "next/navigation";
import { SettlementScreen } from "@/src/screens/SettlementScreen";

export default function Settlement() {
  const router = useRouter();
  // ponytail: 증빙 업로드(onUpload)는 받을 API 가 없어 미연결.
  return <SettlementScreen onNavigate={(to) => router.push(to)} />;
}
