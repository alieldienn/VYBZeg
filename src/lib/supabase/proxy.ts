import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Runs before every page request (from src/proxy.ts). Refreshes an expiring
 * login token and passes the fresh cookie both to the page being rendered and
 * back to the browser, so people stay logged in.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });

  // Don't add code between createServerClient and getClaims(): it can cause
  // hard-to-debug random logouts (per the Supabase docs).
  const { data } = await supabase.auth.getClaims();

  return { response, userId: data?.claims?.sub ?? null };
}
