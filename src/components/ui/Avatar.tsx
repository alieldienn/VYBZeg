import Image from "next/image";
import type { User } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: string; text: string; px: number }> = {
  xs: { box: "h-6 w-6", text: "text-[10px]", px: 24 },
  sm: { box: "h-8 w-8", text: "text-xs", px: 32 },
  md: { box: "h-10 w-10", text: "text-sm", px: 40 },
  lg: { box: "h-14 w-14", text: "text-lg", px: 56 },
  xl: { box: "h-24 w-24", text: "text-3xl", px: 96 },
};

type AvatarProps = {
  user: Pick<User, "name" | "avatarHue" | "avatarUrl">;
  size?: Size;
  ring?: boolean;
  className?: string;
};

export function Avatar({ user, size = "md", ring = false, className }: AvatarProps) {
  const s = SIZES[size];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        s.box,
        s.text,
        ring && "ring-2 ring-canvas",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${user.avatarHue} 75% 62%), hsl(${user.avatarHue + 40} 70% 42%))`,
      }}
      aria-hidden={!user.avatarUrl}
    >
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt={user.name}
          width={s.px}
          height={s.px}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 4,
  size = "sm",
}: {
  users: Pick<User, "id" | "name" | "avatarHue" | "avatarUrl">[];
  max?: number;
  size?: Size;
}) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex items-center -space-x-2">
      {shown.map((user) => (
        <Avatar key={user.id} user={user} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-raised font-semibold text-muted ring-2 ring-canvas",
            SIZES[size].box,
            SIZES[size].text,
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
