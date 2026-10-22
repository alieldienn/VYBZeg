import type { PostgrestError } from "@supabase/supabase-js";

/** What a database call returns to the screens: an error to show, if any. */
export type Result<T = object> = T & { error?: string; expired?: boolean };

/** True when the login has expired or been revoked (the user must log in again). */
export function isSessionError(error: Pick<PostgrestError, "code" | "message"> | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST301" || error.code === "PGRST302" || /jwt|token.*expired|not authenticated/i.test(error.message);
}

/** Turns a Supabase/PostgreSQL error into a short, friendly sentence. */
export function friendlyDbError(error: Pick<PostgrestError, "code" | "message">, fallback = "Something went wrong. Please try again.") {
  if (isSessionError(error)) return "Your session expired. Please log in again.";
  if (/failed to fetch|network|load failed/i.test(error.message)) return "No connection. Check your internet and try again.";
  switch (error.code) {
    case "42501": // Row Level Security said no
      return "You don't have permission to do that.";
    case "23505": // unique rule
      return "That already exists.";
    case "23514": // check rule (lengths, formats)
      return "Some of those details aren't valid. Please check and try again.";
    case "23503": // the thing it points at is gone
      return "That no longer exists. Refresh and try again.";
    default:
      return fallback;
  }
}

/** Builds the `{ error, expired }` result for a failed call. */
export function failure(error: Pick<PostgrestError, "code" | "message">, fallback?: string): Result {
  return { error: friendlyDbError(error, fallback), expired: isSessionError(error) };
}
