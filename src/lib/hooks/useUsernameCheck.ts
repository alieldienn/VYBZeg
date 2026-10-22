"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { USERNAME_PATTERN } from "@/lib/validation";

export type UsernameStatus = "invalid" | "checking" | "available" | "taken" | "yours";

/**
 * Asks the database whether a username is free, shortly after typing stops.
 * `current` is the person's existing username (counts as "yours", not taken).
 * The final say is still the database's unique rule when saving.
 */
export function useUsernameCheck(username: string, current?: string): UsernameStatus {
  // Result of the last finished lookup.
  const [lookup, setLookup] = useState<{ username: string; taken: boolean } | null>(null);
  const valid = USERNAME_PATTERN.test(username);
  const isCurrent = Boolean(current) && username === current;

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username) || username === current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc("find_profile_by_username", { p_username: username });
      if (!cancelled && !error) setLookup({ username, taken: (data ?? []).length > 0 });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, current]);

  if (!valid) return "invalid";
  if (isCurrent) return "yours";
  if (lookup?.username !== username) return "checking";
  return lookup.taken ? "taken" : "available";
}
