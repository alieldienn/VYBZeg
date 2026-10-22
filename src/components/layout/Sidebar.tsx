"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus } from "lucide-react";
import { Logo, TAGLINE } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { buttonStyles } from "@/components/ui/Button";
import { Tag } from "@/components/ui/DemoNotice";
import { useVybz } from "@/lib/store";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Desktop navigation. Hidden on phones, where BottomNav is used instead. */
export function Sidebar() {
  const pathname = usePathname();
  return <SidebarPanel pathname={pathname} />;
}

/** Rendered without an active link while the current URL is still loading. */
export function SidebarPanel({ pathname }: { pathname: string | null }) {
  const { me } = useVybz();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-canvas px-4 py-6 lg:flex">
      <Link href="/" className="px-3" aria-label="VYBZ home">
        <Logo priority className="h-12" />
        <span className="mt-2 block whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-soft/80">
          {TAGLINE}
        </span>
      </Link>

      <nav aria-label="Main" className="mt-8">
        <ul className="space-y-1">
          {NAV_ITEMS.filter((item) => item.href !== "/post").map(({ href, label, icon: Icon }) => {
            const active = pathname !== null && isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition-all",
                    active ? "bg-elevated text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5 transition-colors", active ? "text-glow" : "group-hover:text-fg")}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link href="/post" className={buttonStyles({ size: "lg", className: "mt-6 w-full" })}>
        <CirclePlus className="h-5 w-5" />
        New vibe
      </Link>

      <div className="mt-auto space-y-3">
        <div className="rounded-2xl border border-line bg-surface p-3.5 text-xs leading-relaxed text-muted">
          <Tag>Demo build</Tag>
          <p className="mt-2">Sample data only. Nothing you do here is saved or shared.</p>
        </div>
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.04]"
        >
          <Avatar user={me} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{me.name}</span>
            <span className="block truncate text-xs text-muted">@{me.username}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
