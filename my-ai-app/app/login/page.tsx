import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Welcome back"><div /></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
