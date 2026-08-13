"use client";

import { useRouter } from "next/navigation";
import { LoginScreen } from "@/src/screens/LoginScreen";
import { setRole } from "@/src/lib/role";

export default function Login() {
  const router = useRouter();
  return (
    <LoginScreen
      onLogin={(role) => {
        setRole(role);
        router.push("/home");
      }}
      onDemo={() => router.push("/demo")}
      onSignup={() => router.push("/signup")}
    />
  );
}
