"use client";

import dynamic from "next/dynamic";

const AppsPageContent = dynamic(
  () => import("@/components/apps/AppsPageContent"),
  { ssr: false }
);

export default function AppsPageWrapper() {
  return <AppsPageContent />;
}
