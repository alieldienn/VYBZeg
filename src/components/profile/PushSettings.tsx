"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { REMINDER_TIMES } from "@/lib/constants";
import {
  DEFAULT_PUSH_PREFERENCES,
  fetchPushPreferences,
  pushStatus,
  savePushPreferences,
  sendTestPush,
  turnOffPush,
  turnOnPush,
  type PushPreferences,
  type PushStatus,
} from "@/lib/push";
import { useVybz } from "@/lib/store";

const STATUS_TEXT: Record<Exclude<PushStatus, "on" | "off">, string> = {
  unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.",
  "needs-install":
    "On iPhone and iPad, install VYBZ first: tap Share, then Add to Home Screen. Open VYBZ from your Home Screen and turn them on here.",
  unavailable: "Phone notifications aren't available in this version of VYBZ.",
  blocked: "Blocked in your browser. Allow notifications for VYBZ in your browser's site settings, then come back here.",
};

/** Profile → Notifications: turn phone/computer alerts on for this device, and choose what buzzes. */
export function PushSettings() {
  const { showToast } = useVybz();
  const [status, setStatus] = useState<PushStatus | "loading">("loading");
  const [prefs, setPrefs] = useState<PushPreferences | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | "test" | null>(null);

  useEffect(() => {
    let cancelled = false;
    pushStatus()
      .then((value) => !cancelled && setStatus(value))
      .catch(() => !cancelled && setStatus("unsupported"));
    fetchPushPreferences().then((result) => {
      if (!cancelled) setPrefs(result.prefs ?? DEFAULT_PUSH_PREFERENCES);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setBusy("on");
    const result = await turnOnPush();
    setBusy(null);
    if (result.error) {
      showToast(result.error, "error");
      setStatus(await pushStatus());
      return;
    }
    setStatus("on");
    showToast("Notifications are on for this device");
  }

  async function turnOff() {
    setBusy("off");
    const result = await turnOffPush();
    setBusy(null);
    if (result.error) showToast(result.error, "error");
    setStatus(await pushStatus());
  }

  async function test() {
    setBusy("test");
    const result = await sendTestPush();
    setBusy(null);
    if (result.error) showToast(result.error, "error");
    else showToast(result.sent ? "Test sent! It should appear in a moment." : "No devices found. Turn notifications on first.");
  }

  async function change(changes: Partial<PushPreferences>) {
    if (!prefs) return;
    const before = prefs;
    const next = { ...prefs, ...changes };
    setPrefs(next); // Show it right away…
    const result = await savePushPreferences(next);
    if (result.error) {
      setPrefs(before); // …and undo if saving failed.
      showToast(result.error, "error");
    }
  }

  const ready = prefs !== null;
  return (
    <>
      <div className="py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {status === "on" ? <BellRing className="h-4 w-4 text-brand-soft" aria-hidden /> : <Bell className="h-4 w-4 text-subtle" aria-hidden />}
              On this device
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {status === "loading"
                ? "Checking…"
                : status === "on"
                  ? "Alerts arrive even when VYBZ is closed."
                  : status === "off"
                    ? "Get alerts on this phone or computer, even when VYBZ is closed."
                    : STATUS_TEXT[status]}
            </p>
          </div>
          {status === "off" && (
            <Button size="sm" onClick={turnOn} disabled={busy !== null}>
              {busy === "on" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Turn on
            </Button>
          )}
          {status === "on" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-success">
              <Check className="h-4 w-4" aria-hidden />
              On
            </span>
          )}
        </div>
        {status === "on" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={test} disabled={busy !== null}>
              {busy === "test" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Send a test
            </Button>
            <Button size="sm" variant="ghost" onClick={turnOff} disabled={busy !== null}>
              {busy === "off" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Turn off on this device
            </Button>
          </div>
        )}
      </div>

      <p className="py-3 text-xs leading-relaxed text-muted">
        Choose what buzzes your phone. The{" "}
        <Link href="/notifications" className="font-medium text-brand-soft hover:underline">
          bell on Home
        </Link>{" "}
        always shows everything. These settings follow your account to every device.
      </p>
      <Switch
        label="Friend requests"
        description="New requests and when someone accepts yours"
        checked={prefs?.push_friends ?? true}
        onChange={(push_friends) => change({ push_friends })}
        disabled={!ready}
      />
      <Switch
        label="Reactions & comments"
        description="When friends react to or comment on your vibes"
        checked={prefs?.push_reactions ?? true}
        onChange={(push_reactions) => change({ push_reactions })}
        disabled={!ready}
      />
      <Switch
        label="Circles"
        description="Invites, and people joining your circles"
        checked={prefs?.push_circles ?? true}
        onChange={(push_circles) => change({ push_circles })}
        disabled={!ready}
      />
      <Switch
        label="Plans & polls"
        description="New plans, votes on yours, and locked-in plans"
        checked={prefs?.push_plans ?? true}
        onChange={(push_plans) => change({ push_plans })}
        disabled={!ready}
      />
      <Switch
        label="Daily Vibe reminder"
        description="A nudge when today's prompt drops, only if you haven't posted yet"
        checked={prefs?.daily_reminder ?? true}
        onChange={(daily_reminder) => change({ daily_reminder })}
        disabled={!ready}
      />
      <div className={prefs?.daily_reminder === false || !ready ? "pointer-events-none pb-3.5 opacity-40" : "pb-3.5"}>
        <p className="mb-2 text-xs text-muted">Remind me in the… (Cairo time: about 9 AM, 2 PM or 8 PM)</p>
        <Segmented
          label="Reminder time"
          value={prefs?.reminder_time ?? "surprise"}
          onChange={(reminder_time) => change({ reminder_time })}
          options={REMINDER_TIMES.map((time) => ({ ...time, disabled: !ready || prefs?.daily_reminder === false }))}
          className="flex-wrap"
        />
      </div>
    </>
  );
}
