import dynamic from "next/dynamic";
import Topbar from "@/components/layout/Topbar";
import BalanceCard from "@/components/dashboard/BalanceCard";
import WalletBanner from "@/components/dashboard/WalletBanner";
import QuickActions from "@/components/dashboard/QuickActions";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import DashboardFooter from "@/components/dashboard/DashboardFooter";

const WelcomeSteps = dynamic(() => import("@/components/dashboard/WelcomeSteps"));
const DCASummaryCard = dynamic(() => import("@/components/dashboard/DCASummaryCard"), {
  loading: () => (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="h-4 w-24 rounded skeleton mb-4" />
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-10 rounded-xl skeleton" />
        ))}
      </div>
    </div>
  ),
});

// Below-the-fold components — lazy loaded to reduce initial bundle
const STXMarketStatsCard = dynamic(() => import("@/components/dashboard/STXMarketStats"), {
  loading: () => (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-4 shadow-sm">
          <div className="h-3 w-16 rounded skeleton" />
          <div className="h-6 w-24 rounded skeleton mt-2" />
          <div className="h-12 rounded-lg skeleton mt-3" />
        </div>
      ))}
    </div>
  ),
});

const GreedIndexCard = dynamic(() => import("@/components/dashboard/GreedIndexCard"), {
  loading: () => (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="h-4 w-24 rounded skeleton mb-4" />
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-52 h-28 rounded-xl skeleton" />
      </div>
    </div>
  ),
});

const TrendingTokens = dynamic(() => import("@/components/dashboard/TrendingTokens"), {
  loading: () => (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="h-4 w-20 rounded skeleton mb-4" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded skeleton" />
              <div className="h-3 w-12 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

const DCAPerformanceCard = dynamic(() => import("@/components/dashboard/DCAPerformanceCard"), {
  loading: () => null,
});

const PoxCycleCard = dynamic(() => import("@/components/dashboard/PoxCycleCard"), {
  loading: () => (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="h-4 w-32 rounded skeleton mb-4" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
      </div>
      <div className="h-2 rounded-full skeleton mt-4" />
    </div>
  ),
});

const CryptoNews = dynamic(() => import("@/components/dashboard/CryptoNews"), {
  loading: () => (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="h-4 w-24 rounded skeleton mb-4" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-full rounded skeleton" />
              <div className="h-3 w-3/4 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

const RecentActivity = dynamic(() => import("@/components/dashboard/RecentActivity"), {
  loading: () => (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <div className="h-4 w-28 rounded skeleton mb-4" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full skeleton" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded skeleton" />
              <div className="h-3 w-32 rounded skeleton" />
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

          {/* Welcome steps for new users */}
          <MotionCard>
            <WelcomeSteps />
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

          {/* PoX cycle countdown — Stacks-native featured card */}
          <MotionCard>
            <PoxCycleCard />
          </MotionCard>

          {/* DCA performance (auto-hides until user has executed ≥1 swap) */}
          <MotionCard>
            <DCAPerformanceCard />
          </MotionCard>

          {/* DCA Summary + Greed Index + Trending — 3-column row to reduce scroll */}
          <MotionCard>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-start">
              <DCASummaryCard />
              <GreedIndexCard />
              <TrendingTokens />
            </div>
          </MotionCard>

          {/* Crypto News + Recent Activity side by side */}
          <MotionCard >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
              <div className="lg:col-span-2">
                <CryptoNews />
              </div>
              <RecentActivity />
            </div>
          </MotionCard>
        </StaggerChildren>
        <DashboardFooter />
      </AnimatedPage>
    </div>
  );
}
