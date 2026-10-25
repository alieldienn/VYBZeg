"use server";

/*
 * Server Actions for accounts. They run on the server when a form is
 * submitted, re-check every input (the browser can't be trusted), and turn
 * Supabase errors into friendly messages. Passwords go straight to Supabase
 * Auth and are never stored or logged by VYBZ.
 */
import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cleanDisplayName, displayNameError, usernameError } from "@/lib/validation";
import { safeNextPath } from "./paths";
import { getSessionUser } from "./session";

export type FormState = {
  error?: string;
  /** Field that caused the error, so the form can highlight it. */
  field?: string;
  /** Success message shown instead of the form (e.g. "check your email"). */
  done?: string;
  /** Values to put back into the form after an error. */
  values?: Record<string, string>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** The site's own address, used to build links inside emails. */
async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

function friendlyAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox (and spam) for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try logging in.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one with numbers or symbols.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "email_address_not_authorized":
      return "We can't send email to this address yet (the email service is still in test mode).";
    case "signup_disabled":
      return "Sign-ups are closed right now.";
    case "session_not_found":
    case "session_expired":
      return "Your session expired. Please log in again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { email };

  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", field: "email", values };
  if (!password) return { error: "Enter your password.", field: "password", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyAuthError(error), values };

  // Who is logged in changed: drop pages the browser remembered from before.
  revalidatePath("/", "layout");
  redirect(safeNextPath(text(formData, "next")));
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { email };

  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", field: "email", values };
  if (password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for your password.`, field: "password", values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/onboarding` },
  });
  if (error) return { error: friendlyAuthError(error), values };

  // Supabase answers "success" for an email that already has a confirmed
  // account, but sends nothing. Such a reply has no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Try logging in.", field: "email", values };
  }

  // Email confirmation turned off in Supabase: the user is logged in already.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  return {
    done: `We sent a confirmation link to ${email}. Open it on this device to finish creating your account.`,
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", field: "email", values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  // Only rate limits are shown. Other errors are hidden so this form can't be
  // used to find out which emails have VYBZ accounts.
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { error: friendlyAuthError(error), values: { email } };
  }
  return { done: `If ${email} has a VYBZ account, a reset link is on its way. It expires in 1 hour.` };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!(await getSessionUser())) {
    return { error: "This reset link has expired. Request a new one." };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for your password.`, field: "password" };
  }
  if (password !== confirm) return { error: "The two passwords don't match.", field: "confirm" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error) };

  revalidatePath("/", "layout");
  redirect("/?password=updated");
}

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const username = text(formData, "username").toLowerCase();
  const displayName = cleanDisplayName(text(formData, "displayName"));
  const avatarPath = text(formData, "avatarPath") || null;
  const values = { username, displayName };

  const nameProblem = displayNameError(displayName);
  if (nameProblem) return { error: nameProblem, field: "displayName", values };
  const usernameProblem = usernameError(username);
  if (usernameProblem) return { error: usernameProblem, field: "username", values };
  if (avatarPath && !avatarPath.startsWith(`${user.id}/`)) {
    return { error: "That photo upload didn't work. Please pick it again.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .insert({ id: user.id, username, display_name: displayName, avatar_path: avatarPath });

  if (error) {
    if (error.code === "23505") {
      // Unique violation: either the username is taken or the profile already exists.
      const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (existing) return { done: "/" };
      return { error: `@${username} is taken. Try another one.`, field: "username", values };
    }
    return { error: "We couldn't save your profile. Please try again.", values };
  }

  // The form does a full page load to this address. The browser had remembered
  // the app pages as "go to onboarding", and a full load is the reliable way
  // to forget that (tested: a router redirect reused the stale answer).
  return { done: "/?welcome=1" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

