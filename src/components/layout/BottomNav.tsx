"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Mobile tab bar, pinned to the bottom of the screen. Hidden on desktop. */
export function BottomNav() {
  const pathname = usePathname();
  return <BottomNavBar pathname={pathname} />;
}

/** Rendered without an active tab while the current URL is still loading. */
export function BottomNavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          if (href === "/post") {
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label="Create a post"
                  aria-current={active ? "page" : undefined}
                  className="flex h-11 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_6px_24px_-6px_rgb(139_92_246/0.8)] transition-transform active:scale-95"
                >
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors",
                  active ? "text-fg" : "text-subtle hover:text-muted",
                )}
              >
                <Icon className={cn("h-6 w-6", active && "text-glow")} strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
