"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useVybz } from "@/lib/store";

/**
 * One-off messages passed in the address, e.g. /?welcome=1 after onboarding
 * or /?password=updated after a reset. Shows the toast, then tidies the address.
 * Reads the address, so it must sit inside <Suspense>.
 */
export function FlashMessages() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { me, showToast } = useVybz();

  const welcome = searchParams.has("welcome");
  const passwordUpdated = searchParams.get("password") === "updated";
  // Remembers which message was shown, so it appears once even if this re-runs.
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!welcome && !passwordUpdated) {
      shown.current = null;
      return;
    }
    const key = welcome ? "welcome" : "password";
    if (shown.current === key) return;
    shown.current = key;
    showToast(welcome ? `Welcome to VYBZ, ${me.name.split(" ")[0]}!` : "Password updated");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("welcome");
    params.delete("password");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [welcome, passwordUpdated, me.name, pathname, router, searchParams, showToast]);

  return null;
}
