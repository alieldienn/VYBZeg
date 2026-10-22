/*
 * The two PUBLIC Supabase settings, read from .env.local.
 * Both are safe in the browser: the publishable key only allows what the
 * database's Row Level Security rules allow. Never add a secret key here.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local, fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart `npm run dev`.",
    );
  }
  return { url, key };
}
