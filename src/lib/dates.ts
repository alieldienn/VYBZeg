/*
 * Dates in Egypt time. VYBZ launches in Egypt, so "today", daily prompts and
 * streaks follow Cairo's calendar day no matter where the server runs.
 * Days are plain "YYYY-MM-DD" strings, which sort and compare correctly.
 */
const CAIRO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Cairo calendar day of a moment, e.g. "2026-10-22". */
export function cairoDay(date: Date | string = new Date()) {
  return CAIRO_DAY.format(typeof date === "string" ? new Date(date) : date);
}

/** The day before a "YYYY-MM-DD" day. */
export function previousDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Days in a row with activity, counting back from today. If there's nothing
 * yet today, the streak is still alive from yesterday.
 */
export function streakFrom(days: Iterable<string>, today = cairoDay()) {
  const active = new Set(days);
  let day = active.has(today) ? today : previousDay(today);
  let streak = 0;
  while (active.has(day)) {
    streak += 1;
    day = previousDay(day);
  }
  return streak;
}

/** An ISO timestamp `days` days ago (for "posts since…" queries). */
export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
