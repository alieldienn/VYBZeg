"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { Sheet } from "@/components/ui/Sheet";
import { CURRENT_USER_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { Circle } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { FriendPicker } from "./FriendPicker";

export function InviteSheet({ circle, open, onClose }: { circle: Circle; open: boolean; onClose: () => void }) {
  const { users, invite, showToast } = useVybz();
  const [selected, setSelected] = useState<string[]>([]);

  const friends = users.filter((user) => user.id !== CURRENT_USER_ID);
  const disabled: Record<string, string> = {};
  for (const id of circle.memberIds) disabled[id] = "Member";
  for (const id of circle.invitedIds) disabled[id] = "Invited";

  function send() {
    invite(circle.id, selected);
    showToast(`${pluralize(selected.length, "invite")} sent (demo)`);
    setSelected([]);
    onClose();
  }

  async function copyLink() {
    // A placeholder address on a reserved test domain. Real invite links come with the backend.
    const link = `https://vybz.example/join/${circle.id}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Demo invite link copied");
    } catch {
      showToast("Couldn't copy. Your browser blocked clipboard access");
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Invite to ${circle.name}`}
      description="Circles are private. Only people you invite can see what's shared here."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={copyLink} className="flex-1 sm:flex-none">
            <Link2 className="h-4 w-4" />
            Copy link
          </Button>
          <Button size="lg" onClick={send} disabled={selected.length === 0} className="flex-1">
            {selected.length ? `Send ${pluralize(selected.length, "invite")}` : "Pick friends"}
          </Button>
        </div>
      }
    >
      <DemoNotice className="mb-4">Nobody is actually notified. Invites are only shown on this device.</DemoNotice>
      <FriendPicker friends={friends} selected={selected} onChange={setSelected} disabled={disabled} />
    </Sheet>
  );
}
