import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PostComposer } from "@/components/post/PostComposer";

export const metadata: Metadata = { title: "New vibe" };

export default function PostPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="New vibe" description="Share a photo or a thought with one of your circles." back={{ href: "/", label: "Home" }} />
      {/* The composer reads ?circle= and ?prompt= from the address. */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[28px] bg-surface" role="status" aria-label="Loading" />}>
        <PostComposer />
      </Suspense>
    </div>
  );
}
