import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleDetail, CircleSkeleton } from "@/components/circles/CircleDetail";

// Circles are private, so the page title stays generic: we don't put circle
// names into server-rendered metadata. The page content loads for members only.
export const metadata: Metadata = { title: "Circle" };

// Reading the circle id from the URL happens inside <Suspense>, so Next.js can
// show the loading placeholder instantly while it resolves.
export default function CirclePage({ params }: PageProps<"/circles/[id]">) {
  return (
    <Suspense fallback={<CircleSkeleton />}>
      {params.then(({ id }) => (
        <CircleDetail id={id} />
      ))}
    </Suspense>
  );
}
