import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Clearly marks features that are simulated in this frontend-only milestone. */
export function DemoNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-fg/80",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <p>
        <span className="font-semibold text-warning">Demo mode · </span>
        {children}
      </p>
    </div>
  );
}

/** A tiny "Demo" / "Soon" label for individual controls. */
export function Tag({ children, tone = "demo" }: { children: ReactNode; tone?: "demo" | "soon" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "demo" && "bg-warning/10 text-warning",
        tone === "soon" && "bg-white/5 text-subtle",
        tone === "brand" && "bg-brand/15 text-brand-soft",
      )}
    >
      {children}
    </span>
  );
}
