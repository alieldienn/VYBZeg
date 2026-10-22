import { Suspense, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { AppShell } from "@/components/layout/AppShell";
import { requireProfile } from "@/lib/auth/session";
import { profileToUser } from "@/lib/supabase/avatars";
import { VybzProvider } from "@/lib/store";

/*
 * Every app screen (Home, Circles, Post, Plans, Profile) sits behind this gate.
 * The server verifies the login and loads the profile before rendering:
 * logged out → /login, no profile yet → /onboarding.
 * Reading the login cookie must happen inside <Suspense> (Cache Components).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <SignedInApp>{children}</SignedInApp>
    </Suspense>
  );
}

async function SignedInApp({ children }: { children: ReactNode }) {
  const { user, profile } = await requireProfile();
  return (
    <VybzProvider me={profileToUser(profile)} userId={user.id} email={user.email ?? ""}>
      <AppShell>{children}</AppShell>
    </VybzProvider>
  );
}

function AppLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading VYBZ">
      <LogoMark className="h-14 w-14 animate-pulse" />
    </div>
  );
}
