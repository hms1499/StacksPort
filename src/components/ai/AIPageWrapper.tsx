"use client";

import dynamic from "next/dynamic";

const AIPageContent = dynamic(() => import("./AIPageContent"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col min-h-screen">
      <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800" />
      <div className="flex-1 bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 animate-pulse ${i >= 2 ? "lg:col-span-2" : ""}`}
            >
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
});

export default function AIPageWrapper() {
  return <AIPageContent />;
}
