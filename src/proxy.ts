import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/*
 * Next.js 16 "Proxy" (formerly called Middleware): runs before each request.
 * For now it only keeps the Supabase login session fresh. Page protection is
 * added with the login screens.
 */
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  // Skip Next.js internals and static files (images, icons, fonts).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
