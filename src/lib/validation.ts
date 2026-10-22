/*
 * Profile rules shared by the browser (instant feedback) and the server
 * (the check that counts). They mirror the database constraints in
 * supabase/migrations/20261022160000_initial_schema.sql, so keep them in sync.
 */
import { LIMITS } from "./constants";

export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const AREA_MAX = 40;

/** What the username box should hold while typing: lowercase, no spaces, max 20. */
export function cleanUsernameInput(value: string) {
  return value.toLowerCase().replace(/\s/g, "").slice(0, 20);
}

/** Collapses repeated spaces and trims. */
export function cleanDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function usernameError(username: string) {
  return USERNAME_PATTERN.test(username)
    ? null
    : "3–20 characters: lowercase letters, numbers, dots and underscores.";
}

export function displayNameError(name: string) {
  const length = cleanDisplayName(name).length;
  return length >= DISPLAY_NAME_MIN && length <= DISPLAY_NAME_MAX
    ? null
    : `Your name needs ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters.`;
}

export function bioError(bio: string) {
  return bio.length <= LIMITS.bio ? null : `Keep your bio under ${LIMITS.bio} characters.`;
}

export function areaError(area: string) {
  return area.length <= AREA_MAX ? null : `Keep your area under ${AREA_MAX} characters.`;
}
