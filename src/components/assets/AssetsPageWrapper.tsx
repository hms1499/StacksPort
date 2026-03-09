"use client";

import dynamic from "next/dynamic";

// Skip SSR to avoid Turbopack issues with @stacks/* browser-only modules
const AssetsPageContent = dynamic(
  () => import("@/components/assets/AssetsPageContent"),
  { ssr: false }
);

export default function AssetsPageWrapper() {
  return <AssetsPageContent />;
}
