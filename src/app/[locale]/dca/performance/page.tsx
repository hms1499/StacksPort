import type { Metadata } from "next";
import DCAPerformanceWrapper from "@/components/dca/performance/DCAPerformanceWrapper";

export const metadata: Metadata = {
  title: "DCA Performance",
  description: "Cost basis and execution history for your STX to sBTC plans.",
  alternates: { canonical: "/dca/performance" },
};

export default function DCAPerformancePage() {
  return <DCAPerformanceWrapper />;
}
