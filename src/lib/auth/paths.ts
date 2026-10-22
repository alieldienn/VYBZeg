/** Pages anyone can open without logging in. */
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth"];

/** Pages a logged-in person has no reason to see. */
export const SIGNED_OUT_ONLY_PATHS = ["/login", "/signup"];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Keeps redirects inside VYBZ (blocks tricks like ?next=https://evil.example). */
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
