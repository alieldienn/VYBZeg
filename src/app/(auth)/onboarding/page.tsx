import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getMyProfile, getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-muted">Loading…</p>}>
      <OnboardingGate />
    </Suspense>
  );
}

/** Only for logged-in people who haven't created their profile yet. */
async function OnboardingGate() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (await getMyProfile(user.id)) redirect("/");
  return <OnboardingForm userId={user.id} email={user.email ?? ""} />;
}
