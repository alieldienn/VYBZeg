import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-28 text-center">
      <p className="font-display text-7xl font-bold text-brand-gradient">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">Wrong vibe</h1>
      <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist. Let&apos;s get you back to your friends.</p>
      <Link href="/" className={buttonStyles({ className: "mt-6" })}>
        Back home
      </Link>
    </div>
  );
}
