import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleDetail } from "@/components/circles/CircleDetail";
import { SAMPLE_CIRCLES } from "@/lib/sample-data";

// Pre-build a page for each sample circle. Circles created in the demo are rendered on demand.
export function generateStaticParams() {
  return SAMPLE_CIRCLES.map((circle) => ({ id: circle.id }));
}

export async function generateMetadata({ params }: PageProps<"/circles/[id]">): Promise<Metadata> {
  const { id } = await params;
  const circle = SAMPLE_CIRCLES.find((c) => c.id === id);
  return { title: circle?.name ?? "Circle" };
}

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

function CircleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse pt-16 lg:pt-24" aria-label="Loading circle">
      <div className="h-56 rounded-[32px] bg-surface" />
      <div className="mt-8 h-40 rounded-[28px] bg-surface" />
    </div>
  );
}
