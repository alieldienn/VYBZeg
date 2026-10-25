"use client";

/*
 * Phone/computer notifications (Web Push) for this device, plus the
 * "what may buzz me" preferences saved to your account.
 *
 * Turning them on: the browser asks permission, then gives us a private push
 * address for this device, which we save (save_push_subscription). The
 * Supabase Edge Function `send-push` uses it to deliver alerts.
 */
import { createClient } from "@/lib/supabase/client";
import { failure, type Result } from "@/lib/supabase/errors";
import type { ReminderTime } from "@/lib/types";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * - "unsupported": this browser can't do push notifications
 * - "needs-install": iPhone/iPad: install VYBZ to the Home Screen first (Apple's rule)
 * - "unavailable": push isn't set up in this copy of the app (e.g. development)
 * - "blocked": you said no before; it has to be allowed in the browser settings
 * - "off" / "on": for this device
 */
export type PushStatus = "unsupported" | "needs-install" | "unavailable" | "blocked" | "off" | "on";

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** The service worker, if VYBZ registered one (production builds only). */
async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (isIos() && !isInstalled()) return "needs-install";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  const reg = await registration();
  if (!reg || !PUBLIC_KEY) return "unavailable";
  if (Notification.permission === "denied") return "blocked";
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription || Notification.permission !== "granted") return "off";
  // The browser may still be subscribed from someone who logged out here:
  // it only counts as "on" if it's saved for YOUR account.
  const { data } = await createClient().from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
  return data ? "on" : "off";
}

function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Asks permission, subscribes this device and saves it to your account. */
export async function turnOnPush(): Promise<Result> {
  const reg = await registration();
  if (!reg || !PUBLIC_KEY) return { error: "Notifications aren't set up in this version of VYBZ yet." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: permission === "denied" ? "Notifications are blocked. Allow them in your browser settings." : "Notifications weren't allowed." };
  }
  let subscription: PushSubscription;
  try {
    subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  } catch {
    return { error: "This browser couldn't turn on notifications. Try again, or use Chrome, Edge or Safari." };
  }
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return { error: "This browser couldn't turn on notifications." };
  const { error } = await createClient().rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
  if (error) {
    await subscription.unsubscribe();
    return failure(error, "We couldn't turn on notifications. Please try again.");
  }
  return {};
}

/** Stops notifications on this device (other devices keep theirs). */
export async function turnOffPush(): Promise<Result> {
  const subscription = await (await registration())?.pushManager.getSubscription();
  if (!subscription) return {};
  const { error } = await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
  return error ? failure(error) : {};
}

/** On log out: this device must stop getting this account's notifications. Never throws. */
export async function forgetThisDevice() {
  try {
    await turnOffPush();
  } catch {}
}

/** Sends "Notifications are on" to all your devices, to check it works. */
export async function sendTestPush(): Promise<Result<{ sent?: number }>> {
  const { data, error } = await createClient().functions.invoke<{ sent?: number; error?: string }>("send-push", { body: { test: true } });
  if (error) {
    // The function explains what went wrong in its reply.
    const reply = await (error as { context?: Response }).context?.json?.().catch(() => null);
    if (typeof reply?.error === "string" && reply.error.includes("VAPID")) {
      return { error: "Phone notifications aren't fully set up on the server yet (missing key)." };
    }
    return { error: "We couldn't send a test notification. Please try again." };
  }
  return { sent: data?.sent ?? 0 };
}

// ------------------------------------------------------------ preferences ---

export type PushPreferences = {
  push_friends: boolean;
  push_reactions: boolean;
  push_circles: boolean;
  push_plans: boolean;
  daily_reminder: boolean;
  reminder_time: ReminderTime;
};

/** Everything on until you change something (same as the database defaults). */
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  push_friends: true,
  push_reactions: true,
  push_circles: true,
  push_plans: true,
  daily_reminder: true,
  reminder_time: "surprise",
};

const PREF_COLUMNS = "push_friends, push_reactions, push_circles, push_plans, daily_reminder, reminder_time";

export async function fetchPushPreferences(): Promise<Result<{ prefs?: PushPreferences }>> {
  const { data, error } = await createClient().from("notification_preferences").select(PREF_COLUMNS).maybeSingle();
  if (error) return failure(error, "We couldn't load your notification settings.");
  return { prefs: data ? { ...data, reminder_time: data.reminder_time as ReminderTime } : DEFAULT_PUSH_PREFERENCES };
}

export async function savePushPreferences(prefs: PushPreferences): Promise<Result> {
  const { error } = await createClient()
    .from("notification_preferences")
    .upsert(prefs, { onConflict: "user_id" });
  return error ? failure(error, "Your notification settings didn't save. Please try again.") : {};
}
