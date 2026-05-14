import { Suspense } from "react";
import Topbar from "@/components/layout/Topbar";
import BubblesPageContent from "@/components/bubbles/BubblesPageContent";

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
