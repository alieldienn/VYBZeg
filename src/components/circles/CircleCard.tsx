"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { AvatarStack } from "@/components/ui/Avatar";
import { THEME_GRADIENTS } from "@/lib/constants";
import { useVybz } from "@/lib/store";
import type { Circle, User } from "@/lib/types";
import { agoText, cn, pluralize } from "@/lib/utils";
import { CircleIcon } from "./CircleIcon";

export function CircleCard({ circle }: { circle: Circle }) {
  const { me, getUser } = useVybz();
  const members = circle.memberIds.map(getUser).filter((u): u is User => Boolean(u));
  const latest = circle.activity[0];
  const latestUser = latest ? getUser(latest.userId) : undefined;

  return (
    <Link
      href={`/circles/${circle.id}`}
      className="group block overflow-hidden rounded-[28px] border border-line bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_20px_50px_-20px_rgb(139_92_246/0.35)]"
    >
      <div className={cn("relative flex h-28 items-end justify-between p-4", THEME_GRADIENTS[circle.color])}>
        <CircleIcon
          emoji={circle.emoji}
          imageUrl={circle.imageUrl}
          size="h-16 w-16"
          emojiSize="text-5xl"
          className="transition-transform duration-300 group-hover:scale-110"
        />
        {circle.streak > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-warning" aria-hidden />
            {circle.streak}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold">{circle.name}</h2>
            {circle.description && <p className="truncate text-sm text-muted">{circle.description}</p>}
          </div>
          {circle.newToday > 0 && (
            <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
              {circle.newToday} new
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2.5">
          <AvatarStack users={members} max={5} size="sm" />
          <span className="text-xs text-muted">{pluralize(members.length, "member")}</span>
        </div>
        {latest && latestUser && (
          <p className="mt-3 truncate border-t border-line pt-3 text-xs text-muted">
            <span className="font-medium text-fg">{latest.userId === me.id ? "You" : latestUser.name.split(" ")[0]}</span> {latest.text} ·{" "}
            {agoText(latest.timeLabel)}
          </p>
        )}
      </div>
    </Link>
  );
}
