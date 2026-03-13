import Topbar from "@/components/layout/Topbar";
import BalanceCard from "@/components/dashboard/BalanceCard";
import GreedIndexCard from "@/components/dashboard/GreedIndexCard";
import WalletBanner from "@/components/dashboard/WalletBanner";
import TrendingTokens from "@/components/dashboard/TrendingTokens";
import RecentActivity from "@/components/dashboard/RecentActivity";
import STXMarketStatsCard from "@/components/dashboard/STXMarketStats";
import QuickActions from "@/components/dashboard/QuickActions";
import CryptoNews from "@/components/dashboard/CryptoNews";

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Dashboard" />
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5 max-w-6xl mx-auto w-full">
        <WalletBanner />

        {/* Balance card full width */}
        <BalanceCard />

        {/* Quick actions — only visible when wallet connected */}
        <QuickActions />

        {/* STX market stats row */}
        <STXMarketStatsCard />

        {/* Greed Index + Trending side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          <GreedIndexCard />
          <TrendingTokens />
        </div>

        {/* Crypto News + Recent Activity side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
          <div className="lg:col-span-2">
            <CryptoNews />
          </div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
