"use client";

/*
 * Dark / Light / Auto theme, saved on this device (localStorage).
 * The colours live in src/app/globals.css; this only flips <html data-theme>.
 * The first paint is handled by the inline script in theme-script.ts.
 */
import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type ThemeChoice = "dark" | "light" | "system";

/** The colour of the phone's status bar / browser bar for each theme. */
const BAR_COLOURS = { dark: "#0b0b0f", light: "#f6f5fa" } as const;

const lightQuery = () => window.matchMedia("(prefers-color-scheme: light)");

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "system" ? saved : "dark";
  } catch {
    return "dark"; // Storage blocked (e.g. private browsing).
  }
}

/** Puts the theme on the page (and the browser/status bar colour). */
export function applyTheme(choice: ThemeChoice = readChoice()) {
  const resolved = choice === "system" ? (lightQuery().matches ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", BAR_COLOURS[resolved]));
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {}
  applyTheme(choice);
  window.dispatchEvent(new Event("vybz:theme"));
}

function subscribe(onChange: () => void) {
  window.addEventListener("vybz:theme", onChange);
  window.addEventListener("storage", onChange); // Changed in another tab.
  return () => {
    window.removeEventListener("vybz:theme", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved choice ("dark" while rendering on the server). */
export function useThemeChoice() {
  return useSyncExternalStore(subscribe, readChoice, () => "dark" as const);
}

/**
 * Keeps the page in sync: applies the theme once loaded (for the bar colour),
 * follows the device when "Auto" is chosen, and follows changes from other tabs.
 */
export function watchTheme() {
  applyTheme();
  const media = lightQuery();
  const update = () => applyTheme();
  media.addEventListener("change", update);
  window.addEventListener("storage", update);
  return () => {
    media.removeEventListener("change", update);
    window.removeEventListener("storage", update);
  };
}
