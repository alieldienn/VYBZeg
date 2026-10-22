import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading, ResetPasswordForm } from "@/components/auth/AuthForms";
import { buttonStyles } from "@/components/ui/Button";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New password" };

/** Reached from the reset email: /auth/confirm logs the person in, then sends them here. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-muted">Checking your link…</p>}>
      <ResetGate />
    </Suspense>
  );
}

async function ResetGate() {
  const user = await getSessionUser();
  if (user) return <ResetPasswordForm />;

  return (
    <>
      <AuthHeading title="Link expired" subtitle="Reset links work once and only for a limited time." />
      <Link href="/forgot-password" className={buttonStyles({ size: "lg", className: "w-full" })}>
        Get a new link
      </Link>
    </>
  );
}
