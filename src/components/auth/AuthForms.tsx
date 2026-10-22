"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, type ReactNode } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormError, TextField } from "@/components/ui/TextField";
import { login, requestPasswordReset, signup, updatePassword, type FormState } from "@/lib/auth/actions";

const LINK_ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Links work once and only for a limited time. Request a new one below.",
};

/** Reads ?next= and ?error= from the address. Must be inside <Suspense>; use LoginFields as the fallback. */
export function LoginForm() {
  const searchParams = useSearchParams();
  return <LoginFields next={searchParams.get("next") ?? ""} linkError={LINK_ERRORS[searchParams.get("error") ?? ""]} />;
}

/** The login form itself. Rendered straight away so the page is never blank. */
export function LoginFields({ next = "", linkError }: { next?: string; linkError?: string }) {
  const [state, action, pending] = useActionState(login, {});

  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Log in to see what your friends are up to." />
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        {linkError && !state.error && <FormError>{linkError}</FormError>}
        {state.error && !state.field && <FormError>{state.error}</FormError>}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.field === "email" ? state.error : null}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.field === "password" ? state.error : null}
          aside={
            <Link href="/forgot-password" className="text-xs font-medium text-brand-soft hover:underline">
              Forgot password?
            </Link>
          }
        />
        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>
      <AuthFooter>
        New to VYBZ?{" "}
        <Link href="/signup" className="font-semibold text-brand-soft hover:underline">
          Create an account
        </Link>
      </AuthFooter>
    </>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, {});

  if (state.done) {
    return <DonePanel title="Check your email" body={state.done} hint="No email? Check spam, or wait a minute and sign up again." />;
  }

  return (
    <>
      <AuthHeading title="Join VYBZ" subtitle="Real friends. More vibes. It takes a minute." />
      <form action={action} className="space-y-4" noValidate>
        {state.error && !state.field && <FormError>{state.error}</FormError>}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.field === "email" ? state.error : null}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters."
          error={state.field === "password" ? state.error : null}
        />
        <SubmitButton pending={pending}>Create account</SubmitButton>
        <p className="text-center text-xs leading-relaxed text-subtle">
          By joining you agree to keep it kind. You can delete your account any time.
        </p>
      </form>
      <AuthFooter>
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-soft hover:underline">
          Log in
        </Link>
      </AuthFooter>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  if (state.done) {
    return <DonePanel title="Check your email" body={state.done} hint="Open the link on this device to choose a new password." />;
  }

  return (
    <>
      <AuthHeading title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link." />
      <form action={action} className="space-y-4" noValidate>
        {state.error && !state.field && <FormError>{state.error}</FormError>}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.field === "email" ? state.error : null}
        />
        <SubmitButton pending={pending}>Send reset link</SubmitButton>
      </form>
      <AuthFooter>
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand-soft hover:underline">
          Back to log in
        </Link>
      </AuthFooter>
    </>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <>
      <AuthHeading title="Choose a new password" subtitle="Make it something only you would know." />
      <form action={action} className="space-y-4" noValidate>
        {state.error && !state.field && <FormError>{state.error}</FormError>}
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters."
          error={state.field === "password" ? state.error : null}
        />
        <TextField
          label="Repeat new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          error={state.field === "confirm" ? state.error : null}
        />
        <SubmitButton pending={pending}>Save new password</SubmitButton>
      </form>
    </>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">{children}</p>;
}

function DonePanel({ title, body, hint }: { title: string; body: string; hint: string }) {
  return (
    <div className="py-2 text-center" role="status">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand-soft">
        <MailCheck className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      <p className="mt-4 text-xs text-subtle">{hint}</p>
      <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-brand-soft hover:underline">
        Back to log in
      </Link>
    </div>
  );
}
