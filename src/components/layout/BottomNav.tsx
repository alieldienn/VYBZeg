"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Mobile tab bar, fixed to the bottom of the screen (like Instagram). Hidden on desktop. */
export function BottomNav() {
  const pathname = usePathname();
  return <BottomNavBar pathname={pathname} />;
}

/** Rendered without an active tab while the current URL is still loading. */
export function BottomNavBar({ pathname }: { pathname: string | null }) {
  const typing = useTypingOnTouchScreen();
  return (
    <nav
      aria-label="Main"
      inert={typing}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/90 backdrop-blur-xl lg:hidden",
        // Room for the iPhone home indicator, and the notch in landscape.
        "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        "transition-transform duration-200 ease-out",
        // Slide away while the keyboard is open, so it never covers what you type.
        typing && "translate-y-full",
      )}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          if (href === "/post") {
            return (
              <li key={href} className="flex items-center justify-center">
                <Link
                  href={href}
                  aria-label="Create a post"
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white",
                    "shadow-[0_6px_24px_-6px_rgb(139_92_246/0.85)] transition-transform active:scale-90",
                    active && "ring-2 ring-glow/70 ring-offset-2 ring-offset-canvas",
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.6} aria-hidden />
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
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:opacity-70",
                  active ? "text-brand-soft" : "text-subtle hover:text-muted",
                )}
              >
                {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand" />}
                <Icon className={cn("h-6 w-6", active && "text-brand")} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Inputs that don't open the on-screen keyboard. */
const NO_KEYBOARD = new Set(["button", "checkbox", "radio", "range", "file", "color", "submit", "reset", "image"]);

/** True while a text field has focus on a touch screen (i.e. the on-screen keyboard is up). */
function useTypingOnTouchScreen() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)");
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      // Wait a frame: while focus moves between fields, nothing is focused for a moment.
      frame = requestAnimationFrame(() => {
        const el = document.activeElement;
        const editable =
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type)) ||
          (el instanceof HTMLElement && el.isContentEditable);
        setTyping(touch.matches && editable);
      });
    };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);
  return typing;
}
