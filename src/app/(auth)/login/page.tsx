import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginFields, LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Log in" };

// LoginForm reads ?next= and ?error= from the address, so it sits inside <Suspense>.
// The fallback is the same form without those extras, so the page is never blank.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFields />}>
      <LoginForm />
    </Suspense>
  );
}
