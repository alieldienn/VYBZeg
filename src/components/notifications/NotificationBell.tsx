"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useVybz } from "@/lib/store";
import { cn } from "@/lib/utils";

/** The bell in the Home header. Shows a badge only when you have unread notifications. */
export function NotificationBell() {
  const { unreadNotifications } = useVybz();
  const unread = unreadNotifications ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-elevated text-muted transition",
        "hover:border-line-strong hover:text-fg active:scale-95",
        unread > 0 && "text-fg",
      )}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-canvas"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
