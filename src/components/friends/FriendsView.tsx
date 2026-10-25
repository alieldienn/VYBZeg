"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, RefreshCw, UserMinus, UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SafetyButton } from "@/components/safety/SafetyButton";
import { SafetySheet } from "@/components/safety/SafetySheet";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { FormError } from "@/components/ui/TextField";
import { removeFriendship, respondToRequest, sendFriendRequest } from "@/lib/social";
import { useVybz } from "@/lib/store";
import type { User } from "@/lib/types";
import { agoText, timeAgo } from "@/lib/utils";
import { cleanUsernameInput } from "@/lib/validation";

export function FriendsView() {
  const { me, friends, requests, getUser, social, reloadSocial, runSocial } = useVybz();
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  // The person in the Report / Block sheet. A new key each time starts it fresh.
  const [safetyFor, setSafetyFor] = useState<User | null>(null);
  const [safetyKey, setSafetyKey] = useState(0);

  function openSafety(user: User) {
    setSafetyKey((n) => n + 1);
    setSafetyFor(user);
  }

  // Fetch fresh requests whenever this screen opens.
  useEffect(() => {
    void reloadSocial();
  }, [reloadSocial]);

  const incoming = requests.filter((r) => r.direction === "incoming");
  const outgoing = requests.filter((r) => r.direction === "outgoing");

  async function act(key: string, change: Parameters<typeof runSocial>[0], success: string) {
    setBusy(key);
    await runSocial(change, success);
    setBusy(null);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Friends" description="Add friends by username. Only friends can be invited to your circles." back={{ href: "/circles", label: "Circles" }} />

      <AddFriendForm />

      {social.status === "error" && (
        <div className="mt-6 rounded-[28px] border border-danger/30 bg-danger/[0.06] px-5 py-6 text-center" role="alert">
          <p className="text-sm text-muted">{social.error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => reloadSocial()}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      )}

      {social.status === "loading" ? (
        <div className="mt-6 space-y-3" role="status" aria-label="Loading friends">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {incoming.length > 0 && (
            <Group title="Requests for you" count={incoming.length}>
              {incoming.map((request) => {
                const user = getUser(request.userId);
                if (!user) return null;
                const key = `in-${user.id}`;
                return (
                  <PersonRow key={key} user={user} note={`Sent ${agoText(timeAgo(request.createdAt))}`}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === key}
                      onClick={() => act(key, respondToRequest(me.id, user.id, false), "Request declined")}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === key}
                      onClick={() => act(key, respondToRequest(me.id, user.id, true), `You're now friends with ${user.name.split(" ")[0]}`)}
                    >
                      {busy === key && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                      Accept
                    </Button>
                    <SafetyButton user={user} onOpen={openSafety} />
                  </PersonRow>
                );
              })}
            </Group>
          )}

          <Group title="Your friends" count={friends.length}>
            {friends.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
                No friends yet. Ask your friends for their VYBZ username and add them above.
              </p>
            ) : (
              friends.map((user) => (
                <PersonRow key={user.id} user={user} note={user.area}>
                  <button
                    type="button"
                    onClick={() => setRemoving(user)}
                    className="rounded-full p-2 text-subtle transition hover:bg-tint/5 hover:text-danger"
                    aria-label={`Remove ${user.name} from friends`}
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                  <SafetyButton user={user} onOpen={openSafety} />
                </PersonRow>
              ))
            )}
          </Group>

          {outgoing.length > 0 && (
            <Group title="Requests you sent" count={outgoing.length}>
              {outgoing.map((request) => {
                const user = getUser(request.userId);
                if (!user) return null;
                const key = `out-${user.id}`;
                return (
                  <PersonRow key={key} user={user} note="Waiting for them to accept">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === key}
                      onClick={() => act(key, removeFriendship(me.id, user.id), "Request cancelled")}
                    >
                      {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Cancel
                    </Button>
                  </PersonRow>
                );
              })}
            </Group>
          )}
        </div>
      )}

      <ConfirmSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        danger
        title={`Remove ${removing?.name ?? ""}?`}
        description="You'll stop being friends. You'll both stay in any circles you share, but you won't be able to invite each other to new ones until you're friends again."
        confirmLabel="Remove friend"
        onConfirm={() => (removing ? runSocial(removeFriendship(me.id, removing.id), "Friend removed") : Promise.resolve(false))}
      />
      {safetyFor && <SafetySheet key={safetyKey} open onClose={() => setSafetyFor(null)} user={safetyFor} />}
    </div>
  );
}

function AddFriendForm() {
  const { me, runSocial } = useVybz();
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username) return;
    setSending(true);
    setError(null);
    const result = await sendFriendRequest(me.id, username);
    // Errors about the username stay next to the box; anything else becomes a toast.
    if (result.error && !result.expired) {
      setError(result.error);
    } else {
      const ok = await runSocial(Promise.resolve(result), result.message);
      if (ok) setUsername("");
    }
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-line bg-surface p-5" noValidate>
      <label htmlFor="friend-username" className="mb-2 block text-sm font-medium">
        Add a friend
      </label>
      <div className="flex gap-2">
        <span className="flex min-w-0 flex-1 items-center rounded-2xl border border-line bg-elevated px-4 focus-within:border-brand/60">
          <span className="mr-0.5 text-subtle">@</span>
          <input
            id="friend-username"
            value={username}
            onChange={(event) => {
              setUsername(cleanUsernameInput(event.target.value.replace(/^@/, "")));
              setError(null);
            }}
            placeholder="their username"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            className="h-12 w-full bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
          />
        </span>
        <Button type="submit" size="lg" disabled={!username || sending} aria-busy={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" />}
          <span className="hidden sm:inline">Send request</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
      {error ? (
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Type their exact username. Your username is <span className="font-semibold text-fg">@{me.username}</span>.
        </p>
      )}
    </form>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        {title}
        <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-muted">{count}</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function PersonRow({ user, note, children }: { user: User; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <Avatar user={user} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted">
          @{user.username}
          {note && ` · ${note}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
