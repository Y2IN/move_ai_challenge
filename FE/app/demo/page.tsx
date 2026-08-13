"use client";

import { useRouter } from "next/navigation";
import { DemoEntryScreen } from "@/src/screens/DemoEntryScreen";
import { setRole } from "@/src/lib/role";

export default function Demo() {
  const router = useRouter();
  return (
    <DemoEntryScreen
      onEnter={(role) => {
        setRole(role);
        router.push("/home");
      }}
      onLogin={() => router.push("/login")}
    />
  );
}
