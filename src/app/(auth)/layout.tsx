import type { ReactNode } from "react";
import { Logo, TAGLINE } from "@/components/brand/Logo";

/** Centered card layout for login, signup, password reset and onboarding (no app navigation). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 py-10 sm:justify-center">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-glow/15 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo priority className="h-12" />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-soft/80">{TAGLINE}</p>
        </div>
        <div className="rounded-[28px] border border-line bg-surface p-5 shadow-2xl shadow-black/40 sm:p-7">{children}</div>
      </div>
    </main>
  );
}
