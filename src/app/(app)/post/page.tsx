import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { PostComposer } from "@/components/post/PostComposer";

export const metadata: Metadata = { title: "New vibe" };

export default function PostPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="New vibe" description="Share a photo or a thought with your friends." back={{ href: "/", label: "Home" }} />
      <PostComposer />
    </div>
  );
}
