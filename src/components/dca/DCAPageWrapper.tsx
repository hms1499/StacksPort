"use client";

// SSR-safe wrapper — identical pattern to AssetsPageWrapper
// @stacks/* packages use browser-only APIs (localStorage, window)
import dynamic from "next/dynamic";

const DCAPageContent = dynamic(() => import("./DCAPageContent"), {
  ssr: false,
  loading: () => (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="h-8 w-40 bg-gray-100 rounded-xl animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  ),
});

export default function DCAPageWrapper() {
  return <DCAPageContent />;
}
