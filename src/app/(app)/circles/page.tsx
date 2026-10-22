import type { Metadata } from "next";
import { CirclesView } from "@/components/circles/CirclesView";

export const metadata: Metadata = { title: "Circles" };

export default function CirclesPage() {
  return <CirclesView />;
}
