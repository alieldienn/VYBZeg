import Link from "next/link";
import { PenLine } from "lucide-react";
import { DailyVibeCard } from "@/components/feed/DailyVibeCard";
import { Feed } from "@/components/feed/Feed";
import { HomeAside } from "@/components/feed/HomeAside";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { InstallCard } from "@/components/pwa/Install";
import { buttonStyles } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto w-full max-w-xl">
        <PageHeader
          title="Home"
          description="What your friends are up to today."
          brand
          action={
            <>
              <span className="hidden sm:block lg:hidden">
                <Link href="/post" className={buttonStyles({ size: "sm" })}>
                  <PenLine className="h-4 w-4" />
                  Post
                </Link>
              </span>
              <NotificationBell />
            </>
          }
        />
        <div className="space-y-6">
          <InstallCard />
          <DailyVibeCard />
          <Feed />
        </div>
      </div>
      <div className="hidden xl:block xl:pt-8">
        <HomeAside />
      </div>
    </div>
  );
}
