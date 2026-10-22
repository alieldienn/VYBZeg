"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { THEME_GRADIENTS } from "@/lib/constants";
import { acceptInvite, cancelInvite } from "@/lib/social";
import { useVybz } from "@/lib/store";
import type { CircleInvite } from "@/lib/types";
import { cn, pluralize, timeAgo, agoText } from "@/lib/utils";

/** Circle invites waiting for you, plus a nudge about friend requests. */
export function InvitesPanel() {
  const { invites, requests } = useVybz();
  const incoming = requests.filter((r) => r.direction === "incoming").length;
  if (!invites.length && !incoming) return null;

  return (
    <section aria-labelledby="pending-title" className="mb-6 space-y-2">
      <h2 id="pending-title" className="text-xs font-semibold uppercase tracking-wider text-subtle">
        Waiting for you
      </h2>
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} />
      ))}
      {incoming > 0 && (
        <Link
          href="/friends"
          className="flex items-center gap-3 rounded-[22px] border border-brand/30 bg-brand/[0.07] p-3 transition hover:bg-brand/[0.12]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/20 text-brand-soft">
            <UserPlus className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{pluralize(incoming, "friend request")}</span>
            <span className="block text-xs text-muted">Tap to accept or decline</span>
          </span>
          <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />
        </Link>
      )}
    </section>
  );
}

function InviteRow({ invite }: { invite: CircleInvite }) {
  const { getUser, runSocial } = useVybz();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const inviter = getUser(invite.inviterId);

  async function respond(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    await runSocial(
      accept ? acceptInvite(invite.circleId) : cancelInvite(invite.id),
      accept ? `You joined ${invite.circleEmoji} ${invite.circleName}` : "Invite declined",
    );
    setBusy(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-line bg-surface p-3">
      <span
        className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl", THEME_GRADIENTS[invite.circleColor])}
        aria-hidden
      >
        {invite.circleEmoji}
      </span>
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <span className="font-semibold">{inviter?.name.split(" ")[0] ?? "A friend"}</span> invited you to{" "}
        <Link href={`/circles/${invite.circleId}`} className="font-semibold hover:underline">
          {invite.circleName}
        </Link>
        <span className="block text-xs text-subtle">{agoText(timeAgo(invite.createdAt))}</span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => respond(false)} disabled={busy !== null}>
          {busy === "decline" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Decline
        </Button>
        <Button size="sm" onClick={() => respond(true)} disabled={busy !== null}>
          {busy === "accept" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Join
        </Button>
      </div>
    </div>
  );
}
