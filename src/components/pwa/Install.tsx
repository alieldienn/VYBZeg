"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { Check, Download, MonitorDown, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { browserName, desktopOs, downloadDesktopShortcut, useInstall } from "@/lib/pwa";
import { useVybz } from "@/lib/store";

const DISMISSED_KEY = "vybz:install-card-dismissed";
/** After "Not now", the Home card stays hidden this long. */
const SNOOZE_DAYS = 30;

function readDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Boolean(at) && Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false; // Storage blocked (e.g. private browsing): just show the card.
  }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener("vybz:install-dismissed", onChange);
  return () => window.removeEventListener("vybz:install-dismissed", onChange);
}

/** "Get the app" card on Home. Only shown when this device can install VYBZ. */
export function InstallCard() {
  const { state, install } = useInstall();
  const { showToast } = useVybz();
  // Hidden while rendering on the server, so the page never flickers.
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);

  if (dismissed || (state !== "prompt" && state !== "ios")) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
    window.dispatchEvent(new Event("vybz:install-dismissed"));
  }

  return (
    <section
      aria-labelledby="install-title"
      className="relative flex gap-3.5 rounded-[28px] border border-brand/30 bg-linear-to-br from-brand/15 via-surface to-surface p-4"
    >
      <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 pr-6">
        <h2 id="install-title" className="font-display text-base font-semibold">
          Get the VYBZ app
        </h2>
        {state === "prompt" ? (
          <>
            <p className="mt-0.5 text-sm text-muted">Add VYBZ to your home screen. It opens full-screen, like any app.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={async () => {
                if (await install()) showToast("VYBZ installed. Find it on your home screen!");
              }}
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
          </>
        ) : (
          <IosSteps />
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-full p-2.5 text-subtle transition hover:bg-tint/5 hover:text-fg"
        aria-label="Not now"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}

/** The "Install VYBZ" row in Profile → App settings. Always there, so a dismissed card isn't the only way. */
export function InstallRow() {
  const { state, install } = useInstall();
  const { showToast } = useVybz();
  if (state === "unknown") return null;

  return (
    <div className="py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Install VYBZ</p>
          <p className="mt-0.5 text-xs text-muted">
            {state === "installed" ? "You're using the installed app." : "Open VYBZ from your home screen, full-screen."}
          </p>
        </div>
        {state === "installed" && (
          <span className="flex items-center gap-1 text-xs font-semibold text-success">
            <Check className="h-4 w-4" aria-hidden />
            Installed
          </span>
        )}
        {state === "prompt" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              if (await install()) showToast("VYBZ installed. Find it on your home screen!");
            }}
          >
            <Download className="h-4 w-4" />
            Install
          </Button>
        )}
      </div>
      {state === "ios" && <IosSteps className="mt-2" />}
      {state === "manual" && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Open your browser&apos;s menu and choose <span className="font-medium text-fg">Install app</span> or{" "}
          <span className="font-medium text-fg">Add to Home screen</span>. If you don&apos;t see it, try Chrome, Edge or Safari.
        </p>
      )}
      {(state === "manual" || state === "prompt") && <DesktopShortcut className="mt-3" />}
    </div>
  );
}

/** Desktop sidebar: install VYBZ as an app, or get a desktop shortcut. Hidden once installed. */
export function SidebarInstall() {
  const { state, install } = useInstall();
  const { showToast } = useVybz();
  if (state === "prompt") {
    return (
      <Button
        variant="secondary"
        className="w-full"
        onClick={async () => {
          if (await install()) showToast("VYBZ installed. Open it from your desktop or Start menu!");
        }}
      >
        <MonitorDown className="h-4 w-4" />
        Install desktop app
      </Button>
    );
  }
  if (state === "manual") return <DesktopShortcut variant="sidebar" />;
  return null;
}

/**
 * A desktop shortcut for computers whose browser didn't offer "Install".
 * Mac/Linux: download a shortcut file. Windows: browsers block shortcut files
 * from websites, so we explain the browser's own install menu and the
 * drag-to-desktop trick instead.
 */
function DesktopShortcut({ className, variant = "row" }: { className?: string; variant?: "row" | "sidebar" }) {
  const os = desktopOs();
  const { showToast } = useVybz();
  if (!os) return null;
  if (os === "windows") return <WindowsShortcutSteps className={className} compact={variant === "sidebar"} />;
  const where = os === "mac" ? "your Desktop or Dock" : "your desktop";
  return (
    <div className={className}>
      <Button
        variant="secondary"
        size={variant === "sidebar" ? "md" : "sm"}
        className={variant === "sidebar" ? "w-full" : undefined}
        onClick={() => {
          downloadDesktopShortcut(os);
          showToast(`Shortcut downloaded. Move it to ${where}.`);
        }}
      >
        <MonitorDown className="h-4 w-4" />
        {variant === "sidebar" ? "Desktop shortcut" : "Download desktop shortcut"}
      </Button>
      {variant === "row" && (
        <p className="mt-1.5 text-xs text-muted">
          A file that opens VYBZ in your browser. Move it to {where} and double-click it.
        </p>
      )}
    </div>
  );
}

/** Windows: how to get VYBZ on the desktop with the browser you're using. */
function WindowsShortcutSteps({ className, compact }: { className?: string; compact?: boolean }) {
  const browser = browserName();
  const menu =
    browser === "edge" ? (
      <>
        <span className="font-medium text-fg">•••</span> menu → <span className="font-medium text-fg">Apps</span> →{" "}
        <span className="font-medium text-fg">Install this site as an app</span>
      </>
    ) : browser === "chrome" ? (
      <>
        <span className="font-medium text-fg">⋮</span> menu → <span className="font-medium text-fg">Cast, save and share</span> →{" "}
        <span className="font-medium text-fg">Install page as app</span>
      </>
    ) : null;
  return (
    <div
      className={
        compact
          ? `rounded-2xl border border-line bg-surface p-3.5 text-xs leading-relaxed text-muted ${className ?? ""}`
          : `text-xs leading-relaxed text-muted ${className ?? ""}`
      }
    >
      <p className="flex items-center gap-1.5 font-semibold text-fg">
        <MonitorDown className="h-4 w-4 text-brand-soft" aria-hidden />
        Add VYBZ to your desktop
      </p>
      <ul className="mt-1.5 space-y-1">
        {menu && <li>{menu}. It also adds a desktop shortcut.</li>}
        <li>
          {menu ? "Or drag" : "Drag"} the <span className="font-medium text-fg">icon at the left of the address bar</span> onto your desktop.
        </li>
      </ul>
    </div>
  );
}

/** iPhone/iPad: there's no install button, so explain the Share menu. */
function IosSteps({ className }: { className?: string }) {
  return (
    <ol className={`mt-1 space-y-1 text-sm text-muted ${className ?? ""}`}>
      <li className="flex flex-wrap items-center gap-1.5">
        1. Tap <Share className="h-4 w-4 text-brand-soft" aria-label="Share" /> <span className="font-medium text-fg">Share</span>
        <span className="text-xs text-subtle">(in Safari it may be under •••)</span>
      </li>
      <li className="flex flex-wrap items-center gap-1.5">
        2. Choose <SquarePlus className="h-4 w-4 text-brand-soft" aria-hidden />
        <span className="font-medium text-fg">Add to Home Screen</span>
      </li>
    </ol>
  );
}
