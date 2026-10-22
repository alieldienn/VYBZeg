import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Shows the VYBZ logo instead of the title on phones (used on Home). */
  brand?: boolean;
  back?: { href: string; label: string };
};

/** Sticky top bar for each screen. */
export function PageHeader({ title, description, action, brand, back }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-6 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-8 lg:backdrop-blur-none">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 mb-1 inline-flex items-center gap-0.5 text-sm text-muted transition hover:text-fg"
        >
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="min-w-0">
          {brand && (
            <span className="lg:hidden">
              <Logo priority />
            </span>
          )}
          <h1 className={brand ? "sr-only lg:not-sr-only lg:font-display lg:text-3xl lg:font-bold lg:tracking-tight" : "truncate font-display text-2xl font-bold tracking-tight lg:text-3xl"}>
            {title}
          </h1>
          {description && <p className="mt-0.5 hidden text-sm text-muted sm:block">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
