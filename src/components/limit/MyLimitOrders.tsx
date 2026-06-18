"use client";
import { useTranslations } from "next-intl";
import { useLimitOrders } from "@/hooks/usePortfolioSnapshot";
import { useSwapPrices } from "@/hooks/useMarketData";
import { useWalletStore } from "@/store/walletStore";
import LimitOrderCard from "./LimitOrderCard";

export default function MyLimitOrders() {
  const t = useTranslations("limit");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { orders, isLoading } = useLimitOrders(addr);
  const { data: swapPrices } = useSwapPrices();
  // sBTC is pegged 1:1 to BTC; swap prices are keyed by CoinGecko id.
  const sbtcUsd = swapPrices?.bitcoin?.usd ?? null;

  if (isLoading) return null;
  if (orders.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
        {t("empty")}
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {orders.map((o) => (
        <LimitOrderCard key={o.id} order={o} currentSbtcUsd={sbtcUsd} />
      ))}
    </div>
  );
}
