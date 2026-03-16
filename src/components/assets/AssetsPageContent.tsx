"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletStore } from "@/store/walletStore";
import { getTokensWithValues, TokenWithValue } from "@/lib/stacks";
import Topbar from "@/components/layout/Topbar";
import PortfolioSummary from "@/components/assets/PortfolioSummary";
import HealthScore from "@/components/assets/HealthScore";
import TokenHoldings from "@/components/assets/TokenHoldings";
import StackingTracker from "@/components/assets/StackingTracker";
import SBTCMonitor from "@/components/assets/SBTCMonitor";
import AssetTransactionHistory from "@/components/assets/AssetTransactionHistory";
import PnLTracker from "@/components/assets/PnLTracker";

export default function AssetsPageContent() {
  const { stxAddress, isConnected } = useWalletStore();
  const [stx, setStx] = useState<TokenWithValue | null>(null);
  const [tokens, setTokens] = useState<TokenWithValue[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [loading, setLoading] = useState(false);
  const prevAddress = useRef(stxAddress);

  const resetState = useCallback(() => {
    setStx(null);
    setTokens([]);
    setTotalUsd(0);
  }, []);

  useEffect(() => {
    if (!isConnected || !stxAddress) {
      // Only reset if address actually changed to avoid cascading renders
      if (prevAddress.current !== stxAddress) {
        prevAddress.current = stxAddress;
        queueMicrotask(resetState);
      }
      return;
    }
    prevAddress.current = stxAddress;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return getTokensWithValues(stxAddress);
      })
      .then((data) => {
        if (cancelled) return;
        setStx(data.stx);
        setTokens(data.tokens);
        setTotalUsd(data.totalUsd);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [stxAddress, isConnected, resetState]);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="My Assets" />
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-5 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PortfolioSummary stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
          <HealthScore stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
        </div>
        <TokenHoldings stx={stx} tokens={tokens} totalUsd={totalUsd} loading={loading} />
        <PnLTracker />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <StackingTracker />
          <SBTCMonitor />
        </div>
        <AssetTransactionHistory />
      </div>
    </div>
  );
}
