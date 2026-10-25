// VYBZ "send-push" Edge Function: delivers phone/computer notifications (Web Push).
//
// Called by:
//  - the database, when a notification is created ({ notification_id }),
//  - the hourly reminder job ({ reminders: true }),
//  - the app's "Send a test" button ({ test: true }, with the signed-in user's token).
//
// It needs no password from the database: a notification is pushed only once
// (pushed_at) and only within 10 minutes of being created, and reminders at
// most once a day per person (see 20261023180000_push_notifications.sql).
//
// Secrets: VAPID_PRIVATE_KEY (set in Supabase → Edge Functions → Secrets).
// SUPABASE_URL and the service role key are provided by Supabase automatically.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

/** The PUBLIC half of the key pair (same as NEXT_PUBLIC_VAPID_PUBLIC_KEY in the app). */
const VAPID_PUBLIC_KEY = "BM7K-O86qoDEFRa00vHHVIi_TyneZveojf_sMK6LcsjVcBfnms6CrVKcqSgEvVsdQvGg8yqE3qJ62zatVKDrl0o";
/** Who push services can contact about this sender. */
const VAPID_SUBJECT = "https://kpybkxjjqxhfnjogismr.supabase.co";

const REACTION_EMOJI: Record<string, string> = { fire: "🔥", lol: "😂", love: "😍", care: "🫶", wow: "😮" };
/** Which preference switch controls each kind of notification. */
const PREFERENCE: Record<string, string> = {
  friend_request: "push_friends",
  friend_accepted: "push_friends",
  reaction: "push_reactions",
  comment: "push_reactions",
  circle_invite: "push_circles",
  circle_joined: "push_circles",
  plan_created: "push_plans",
  plan_vote: "push_plans",
  plan_locked: "push_plans",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

type Message = { title: string; body: string; url: string; tag: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function short(text: string | null | undefined, max = 120) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Sends one message to every device of a person. Forgets devices that no longer exist. */
async function sendToUser(userId: string, message: Message) {
  const { data: devices } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const device of devices ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(message),
        { TTL: 60 * 60 * 24, urgency: "normal" },
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410: the browser dropped this subscription (app uninstalled, permission removed…).
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", device.id);
      else console.error("push failed", status, (error as Error).message);
    }
  }
  return sent;
}

/** Turns a notification row into the words people see on their lock screen. */
function messageFor(n: {
  id: string;
  type: string;
  detail: string | null;
  circle_id: string | null;
  actor: { display_name: string } | null;
  circle: { name: string; emoji: string } | null;
  poll: { question: string } | null;
  comment: { content: string } | null;
}): Message {
  const who = n.actor?.display_name ?? "Someone";
  const circle = n.circle ? `${n.circle.emoji} ${n.circle.name}` : "your circle";
  const circleUrl = n.circle_id ? `/circles/${n.circle_id}` : "/";
  const tag = `vybz-${n.id}`;
  switch (n.type) {
    case "friend_request":
      return { title: `${who} sent you a friend request`, body: "Tap to answer.", url: "/friends", tag };
    case "friend_accepted":
      return { title: `${who} accepted your friend request`, body: "You're friends now 🎉", url: "/friends", tag };
    case "reaction":
      return { title: `${who} reacted ${REACTION_EMOJI[n.detail ?? ""] ?? ""} to your vibe`, body: circle, url: circleUrl, tag };
    case "comment":
      return { title: `${who} commented on your vibe`, body: short(n.comment?.content) || circle, url: circleUrl, tag };
    case "circle_invite":
      return { title: `${who} invited you to ${circle}`, body: "Tap to join.", url: "/circles", tag };
    case "circle_joined":
      return { title: `${who} joined ${circle}`, body: "Say hi 👋", url: circleUrl, tag };
    case "plan_created":
      return { title: `${who} started a plan in ${circle}`, body: short(n.poll?.question) || "Vote now", url: "/plans", tag };
    case "plan_vote": {
      const votes = Number(n.detail ?? 0);
      return {
        title: `${who} voted on your plan`,
        body: `${short(n.poll?.question, 90)}${votes > 1 ? ` · ${votes} votes` : ""}`,
        url: "/plans",
        tag,
      };
    }
    case "plan_locked":
      return {
        title: n.detail ? `Plan locked: ${n.detail}` : "A plan was locked in",
        body: short(n.poll?.question) || circle,
        url: "/plans",
        tag,
      };
    default:
      return { title: "VYBZ", body: "You have a new notification.", url: "/notifications", tag };
  }
}

async function pushNotification(id: string) {
  // Claim it: only once, and only while it's fresh. Anything else is ignored.
  const freshSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: n } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("id", id)
    .is("pushed_at", null)
    .gte("created_at", freshSince)
    .select(
      `id, type, detail, user_id, circle_id,
       actor:profiles!notifications_actor_id_fkey(display_name),
       circle:circles!notifications_circle_id_fkey(name, emoji),
       poll:polls!notifications_poll_id_fkey(question),
       comment:comments!notifications_comment_id_fkey(content)`,
    )
    .maybeSingle();
  if (!n) return { skipped: "already pushed, too old, or not found" };

  const { data: prefs } = await admin.from("notification_preferences").select("*").eq("user_id", n.user_id).maybeSingle();
  const key = PREFERENCE[n.type];
  if (prefs && key && prefs[key] === false) return { skipped: "turned off in settings" };

  // @ts-ignore: embedded rows come back as objects here.
  return { sent: await sendToUser(n.user_id, messageFor(n)) };
}

async function pushReminders() {
  const { data, error } = await admin.rpc("claim_daily_reminders");
  if (error) throw new Error(error.message);
  let sent = 0;
  for (const row of data ?? []) {
    const message: Message = row.prompt_id
      ? {
          title: `${row.prompt_emoji} ${row.prompt_text}`,
          body: "Today's Daily Vibe is live. Share yours with your circle!",
          url: `/post?prompt=${row.prompt_id}`,
          tag: "vybz-daily",
        }
      : { title: "Time for today's vibe ✨", body: "What are you up to? Share it with your circle.", url: "/post", tag: "vybz-daily" };
    sent += await sendToUser(row.user_id, message);
  }
  return { reminded: data?.length ?? 0, sent };
}

async function pushTest(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please log in." }, 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: "Please log in." }, 401);
  const sent = await sendToUser(data.user.id, {
    title: "Notifications are on ✨",
    body: "This is how VYBZ will tell you about friends, vibes and plans.",
    url: "/notifications",
    tag: "vybz-test",
  });
  return json({ sent });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!privateKey) return json({ error: "VAPID_PRIVATE_KEY secret is not set." }, 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);

  let body: { notification_id?: string; reminders?: boolean; test?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  try {
    if (typeof body.notification_id === "string" && /^[0-9a-f-]{36}$/i.test(body.notification_id)) {
      return json(await pushNotification(body.notification_id));
    }
    if (body.reminders === true) return json(await pushReminders());
    if (body.test === true) return await pushTest(req);
    return json({ error: "Unknown request." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Something went wrong." }, 500);
  }
});
