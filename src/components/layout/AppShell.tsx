import { Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/Toaster";
import { BottomNav, BottomNavBar } from "./BottomNav";
import { FlashMessages } from "./FlashMessages";
import { Sidebar, SidebarPanel } from "./Sidebar";

/**
 * The frame around every screen: sidebar on desktop, tab bar on phones.
 * The navs read the current URL, so they sit inside <Suspense> with a
 * no-highlight fallback (required by Next.js for pages with unknown URLs).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<SidebarPanel pathname={null} />}>
        <Sidebar />
      </Suspense>
      {/* Bottom space on phones = tab bar (4rem) + breathing room + the iPhone home-indicator area. */}
      <main className="min-h-dvh pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">{children}</div>
      </main>
      <Suspense fallback={<BottomNavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
      <Toaster />
      <Suspense>
        <FlashMessages />
      </Suspense>
    </>
  );
}
