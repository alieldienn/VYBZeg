"use client";

/*
 * Installing VYBZ as an app, and knowing when the device is offline.
 *
 * Install: Android and desktop Chrome/Edge fire a `beforeinstallprompt` event
 * when VYBZ can be installed. A tiny script in the root layout (pwa-script.ts)
 * catches it (it can fire before React has loaded) and keeps it on `window`, so our own
 * "Install" button can open the browser's install dialog later.
 * iPhones and iPads never fire it: there, people install from the Share menu,
 * so we show those steps instead.
 */
import { useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __vybzInstall?: InstallPromptEvent | null;
    __vybzInstalled?: boolean;
  }
}

/**
 * - "installed": running as the installed app (or just installed)
 * - "prompt": we can open the browser's install dialog
 * - "ios": iPhone/iPad, install from the Share menu
 * - "manual": the browser may offer "Install" in its own menu, but no button for us
 * - "unknown": while rendering on the server
 */
export type InstallState = "installed" | "prompt" | "ios" | "manual" | "unknown";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.__vybzInstalled === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but Macs have no touch screen.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function installState(): InstallState {
  if (isStandalone()) return "installed";
  if (window.__vybzInstall) return "prompt";
  return isIos() ? "ios" : "manual";
}

function subscribeInstall(onChange: () => void) {
  const standalone = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("vybz:installable", onChange);
  standalone.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("vybz:installable", onChange);
    standalone.removeEventListener("change", onChange);
  };
}

export function useInstall() {
  const state = useSyncExternalStore(subscribeInstall, installState, () => "unknown" as const);
  return {
    state,
    /** Opens the browser's install dialog. Returns true if the person installed. */
    install: async () => {
      const event = window.__vybzInstall;
      if (!event) return false;
      await event.prompt();
      const { outcome } = await event.userChoice;
      // The event can only be used once.
      window.__vybzInstall = null;
      window.dispatchEvent(new Event("vybz:installable"));
      return outcome === "accepted";
    },
  };
}

// --------------------------------------------------------- desktop shortcut ---

export type DesktopOs = "windows" | "mac" | "linux";

/** The computer's system, or null on phones/tablets (where installing is the way). */
export function desktopOs(): DesktopOs | null {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|CrOS/.test(ua) || (navigator.maxTouchPoints > 1 && ua.includes("Macintosh"))) return null;
  if (ua.includes("Windows")) return "windows";
  if (ua.includes("Macintosh")) return "mac";
  if (ua.includes("Linux")) return "linux";
  return null;
}

/** Which browser, for giving the right "install" steps. */
export function browserName(): "edge" | "chrome" | "firefox" | "safari" | "other" {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("Firefox/")) return "firefox";
  if (ua.includes("Chrome/")) return "chrome";
  if (ua.includes("Safari/")) return "safari";
  return "other";
}

/**
 * Downloads a small shortcut file that opens VYBZ in the browser (Mac: .webloc,
 * Linux: .desktop). Save it on the desktop and double-click it.
 * Not offered on Windows: browsers there refuse to save .url shortcut files
 * from websites (a security rule), so Windows uses installing or drag-to-desktop.
 */
export function downloadDesktopShortcut(os: Exclude<DesktopOs, "windows">) {
  const url = `${window.location.origin}/`;
  const files: Record<Exclude<DesktopOs, "windows">, { name: string; type: string; body: string }> = {
    mac: {
      name: "VYBZ.webloc",
      type: "application/x-apple-plist",
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${url}</string></dict></plist>\n`,
    },
    linux: {
      name: "VYBZ.desktop",
      type: "application/x-desktop",
      body: ["[Desktop Entry]", "Type=Link", "Name=VYBZ", `URL=${url}`, `Icon=${window.location.origin}/icons/icon-192.png`, ""].join("\n"),
    },
  };
  const file = files[os];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([file.body], { type: file.type }));
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ------------------------------------------------------------------ offline ---

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** False when the device has no network at all (assumed online on the server). */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

// ----------------------------------------------------------- service worker ---

/** Registers public/sw.js (production builds only, so development stays simple). */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
    // Not being installable is fine; the website still works normally.
  });
}
