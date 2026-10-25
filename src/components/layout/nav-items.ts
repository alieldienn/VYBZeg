import { CalendarDays, House, Plus, UserRound, UsersRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/circles", label: "Circles", icon: UsersRound },
  { href: "/post", label: "Create", icon: Plus },
  { href: "/plans", label: "Plans", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
