import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

/*
 * Where the links in VYBZ emails land (confirm signup, reset password).
 * Turns the one-time token from the email into a logged-in session cookie,
 * then sends the person on to `next` (e.g. /onboarding or /reset-password).
 *
 * Supports both link styles:
 *  - ?token_hash=…&type=…  (recommended email templates; works on any device)
 *  - ?code=…               (Supabase's default templates; same browser only)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const fallback = type === "recovery" ? "/reset-password" : "/onboarding";
  const next = safeNextPath(searchParams.get("next"), fallback);

  const supabase = await createClient();
  let failed = true;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  // Build the redirect without the secret token in the address bar.
  const destination = request.nextUrl.clone();
  destination.search = "";
  if (failed) {
    destination.pathname = "/login";
    destination.searchParams.set("error", "link");
  } else {
    const target = new URL(next, request.nextUrl.origin);
    destination.pathname = target.pathname;
    destination.search = target.search;
  }
  return NextResponse.redirect(destination);
}
