import { Suspense } from "react";
import type { Metadata } from "next";
import Topbar from "@/components/layout/Topbar";
import BubblesPageContent from "@/components/bubbles/BubblesPageContent";

export const metadata: Metadata = {
  title: "Stacks Market Bubbles",
  description:
    "Visualize Stacks token performance and momentum in an interactive market bubble map.",
  alternates: { canonical: "/bubbles" },
};

export default function BubblesPage() {
  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Bubbles" />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <BubblesPageContent />
        </Suspense>
      </div>
    </div>
  );
}
