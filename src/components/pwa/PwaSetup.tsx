"use client";

import { WifiOff } from "lucide-react";
import { useEffect } from "react";
import { registerServiceWorker, useOnline } from "@/lib/pwa";
import { watchTheme } from "@/lib/theme";

/**
 * App-wide setup, used once in the root layout: starts the service worker,
 * keeps the theme in sync, and shows a banner while the device is offline.
 */
export function PwaSetup() {
  const online = useOnline();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => watchTheme(), []);

  if (online) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <p className="flex max-w-md animate-fade-up items-center gap-2 rounded-full border border-warning/30 bg-elevated/95 px-4 py-2 text-xs font-medium shadow-2xl shadow-black/50 backdrop-blur">
        <WifiOff className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
        You&apos;re offline. Posts, circles and plans need a connection.
      </p>
    </div>
  );
}
