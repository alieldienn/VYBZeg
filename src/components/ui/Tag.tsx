import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A tiny label like "Beta", "Soon" or "You". */
export function Tag({ children, tone = "beta" }: { children: ReactNode; tone?: "beta" | "soon" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "beta" && "bg-warning/10 text-warning",
        tone === "soon" && "border border-brand/25 bg-brand/[0.08] text-brand-soft/90",
        tone === "brand" && "bg-brand/15 text-brand-soft",
      )}
    >
      {children}
    </span>
  );
}

/** The one label used everywhere for features that aren't ready yet. */
export function ComingSoon({ children = "Coming soon" }: { children?: ReactNode }) {
  return <Tag tone="soon">{children}</Tag>;
}
