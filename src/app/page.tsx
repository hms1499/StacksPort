import Topbar from "@/components/layout/Topbar";
import BalanceCard from "@/components/dashboard/BalanceCard";
import GreedIndexCard from "@/components/dashboard/GreedIndexCard";
import TokenList from "@/components/dashboard/TokenList";
import WalletBanner from "@/components/dashboard/WalletBanner";
import TrendingTokens from "@/components/dashboard/TrendingTokens";
import RecentActivity from "@/components/dashboard/RecentActivity";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Dashboard" />
      <div className="flex-1 p-6 space-y-5 max-w-6xl mx-auto w-full">
        <WalletBanner />

        {/* Balance card full width */}
        <BalanceCard />

        {/* Greed Index + Trending side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GreedIndexCard />
          <TrendingTokens />
        </div>

        {/* My Assets + Recent Activity side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <TokenList />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
