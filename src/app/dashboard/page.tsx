import dynamic from "next/dynamic";
import Topbar from "@/components/layout/Topbar";
import BalanceCard from "@/components/dashboard/BalanceCard";
import WalletBanner from "@/components/dashboard/WalletBanner";
import QuickActions from "@/components/dashboard/QuickActions";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";

// Below-the-fold components — lazy loaded to reduce initial bundle
const STXMarketStatsCard = dynamic(() => import("@/components/dashboard/STXMarketStats"), {
  loading: () => (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-16" />
          <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mt-2 w-24" />
          <div className="h-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse mt-3" />
        </div>
      ))}
    </div>
  ),
});

const GreedIndexCard = dynamic(() => import("@/components/dashboard/GreedIndexCard"), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-24 mb-4" />
      <div className="flex flex-col items-center gap-3 py-6 animate-pulse">
        <div className="w-52 h-28 bg-gray-100 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  ),
});

const TrendingTokens = dynamic(() => import("@/components/dashboard/TrendingTokens"), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-20 mb-4" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

const CryptoNews = dynamic(() => import("@/components/dashboard/CryptoNews"), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-24 mb-4" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

const RecentActivity = dynamic(() => import("@/components/dashboard/RecentActivity"), {
  loading: () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-28 mb-4" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Dashboard" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">
          <MotionCard>
            <WalletBanner />
          </MotionCard>

          {/* Balance card full width */}
          <MotionCard>
            <BalanceCard />
          </MotionCard>

          {/* Quick actions — only visible when wallet connected */}
          <MotionCard>
            <QuickActions />
          </MotionCard>

          {/* STX market stats row */}
          <MotionCard>
            <STXMarketStatsCard />
          </MotionCard>

          {/* Greed Index + Trending side by side */}
          <MotionCard>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
              <GreedIndexCard />
              <TrendingTokens />
            </div>
          </MotionCard>

          {/* Crypto News + Recent Activity side by side */}
          <MotionCard>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
              <div className="lg:col-span-2">
                <CryptoNews />
              </div>
              <RecentActivity />
            </div>
          </MotionCard>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
