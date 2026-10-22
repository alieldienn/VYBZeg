"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { inviteToCircle } from "@/lib/social";
import { useVybz } from "@/lib/store";
import type { Circle } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { FriendPicker } from "./FriendPicker";

export function InviteSheet({ circle, open, onClose }: { circle: Circle; open: boolean; onClose: () => void }) {
  const { friends, runSocial } = useVybz();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const disabled: Record<string, string> = {};
  for (const id of circle.memberIds) disabled[id] = "Member";
  for (const id of circle.invitedIds) disabled[id] = "Invited";

  async function send() {
    setSending(true);
    const ok = await runSocial(inviteToCircle(circle.id, selected), `${pluralize(selected.length, "invite")} sent`);
    setSending(false);
    if (ok) {
      setSelected([]);
      onClose();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={sending ? () => {} : onClose}
      title={`Invite to ${circle.name}`}
      description="Circles are private. Only friends you invite can join and see what's shared here. They'll see the invite on their Circles screen."
      footer={
        <Button size="lg" onClick={send} disabled={selected.length === 0 || sending} className="w-full">
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {selected.length ? `Send ${pluralize(selected.length, "invite")}` : "Pick friends"}
        </Button>
      }
    >
      <FriendPicker friends={friends} selected={selected} onChange={setSelected} disabled={disabled} />
    </Sheet>
  );
}
