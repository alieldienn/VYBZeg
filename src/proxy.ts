import { NextResponse, type NextRequest } from "next/server";
import { SIGNED_OUT_ONLY_PATHS, isPublicPath } from "@/lib/auth/paths";
import { updateSession } from "@/lib/supabase/proxy";

/*
 * Next.js 16 "Proxy" (formerly called Middleware): runs before each request.
 * 1. Keeps the Supabase login session fresh.
 * 2. Quick redirects: logged-out visitors go to /login, logged-in people skip
 *    the login/signup pages. This is only a convenience check. The real
 *    protection is the server check in the (app) layout plus the database's
 *    Row Level Security rules.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(url, response);
  }

  if (userId && SIGNED_OUT_ONLY_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** A redirect must carry over any refreshed login cookies, or the user gets logged out. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Skip Next.js internals and static files (images, icons, fonts).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
