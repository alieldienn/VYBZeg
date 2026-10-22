import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "glass";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-[0_8px_30px_-8px_rgb(139_92_246/0.6)] hover:brightness-110 active:brightness-95",
  secondary: "bg-elevated text-fg border border-line hover:bg-raised hover:border-line-strong",
  ghost: "text-muted hover:text-fg hover:bg-white/5",
  danger: "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20",
  /** For use on top of colourful backgrounds and photos. */
  light: "bg-white text-canvas hover:bg-white/90",
  glass: "border border-white/20 bg-black/30 text-white backdrop-blur-md hover:bg-black/45",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-2xl",
  lg: "h-13 px-6 text-base gap-2 rounded-2xl",
  icon: "h-11 w-11 rounded-2xl",
};

/** Shared button styling. Also used to style <Link>s that look like buttons. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold transition-all duration-200",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
