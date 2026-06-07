import type { Metadata } from "next";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import DashboardFooter from "@/components/dashboard/DashboardFooter";
import DashboardGridClient from "@/components/dashboard/DashboardGridClient";
import { getMarketSnapshot } from "@/lib/server/market-snapshot";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Track Stacks market data, your portfolio value, and DCA performance in one non-custodial dashboard.",
  alternates: { canonical: "/dashboard" },
};

// Revalidate the server render at the same cadence as the underlying runtime
// cache. The /api/market/snapshot route caches at 60s; matching it here avoids
// the page render becoming a hotter origin than the API.
export const revalidate = 60;

export default async function DashboardPage() {
  // Fetch the snapshot at render time so the first paint already has the
  // shared market data — the client SWR layer hydrates from it via fallback
  // and only refreshes in the background.
  const marketSnapshot = await getMarketSnapshot();

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Home" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <DashboardGridClient marketSnapshot={marketSnapshot} />
        <DashboardFooter />
      </AnimatedPage>
    </div>
  );
}
