"use client";

import { useRouter } from "next/navigation";
import { LoginScreen } from "@/src/screens/LoginScreen";

export default function Login() {
  const router = useRouter();
  // ponytail: role 은 아직 버린다. HomeScreen 이 자체 토글로 페르소나를 관리 중.
  return (
    <LoginScreen
      onLogin={() => router.push("/home")}
      onDemo={() => router.push("/demo")}
      onSignup={() => router.push("/signup")}
    />
  );
}
