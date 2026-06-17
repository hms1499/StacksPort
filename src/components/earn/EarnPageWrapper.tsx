"use client";

import dynamic from "next/dynamic";

// Skip SSR to avoid Turbopack issues with @stacks/* browser-only modules.
const EarnPageContent = dynamic(
  () => import("@/components/earn/EarnPageContent"),
  { ssr: false }
);

export default function EarnPageWrapper() {
  return <EarnPageContent />;
}
