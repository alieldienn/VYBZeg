import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/*
 * The one place the server reads "who is logged in". getClaims() verifies the
 * login token's signature, so (unlike getSession) it can't be faked by editing
 * a cookie. Wrapped in React `cache` so it runs once per request.
 *
 * These reads use cookies, so with Cache Components every caller must be
 * rendered inside a <Suspense> boundary.
 */

export const getSessionUser = cache(async () => {
  // Login checks compare the token's expiry with the current time, so they must
  // only run for a real request, never while Next.js prerenders a page ahead of time.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return { id: data.claims.sub, email: data.claims.email as string | undefined };
});

export const getMyProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, avatar_hue, bio, area")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your profile: ${error.message}`);
  return data;
});

/** For app pages: logged out → /login, no profile yet → /onboarding. */
export async function requireProfile() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const profile = await getMyProfile(user.id);
  if (!profile) redirect("/onboarding");
  return { user, profile };
}
