"use client";

import { useRouter } from "next/navigation";
import { SignupScreen } from "@/src/screens/SignupScreen";

export default function Signup() {
  const router = useRouter();
  return <SignupScreen onSubmit={() => router.push("/home")} />;
}
