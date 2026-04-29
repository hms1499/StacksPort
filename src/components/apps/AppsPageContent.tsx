"use client";

import { Globe } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps } from "@/hooks/useMarketData";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import ProtocolCard from "@/components/apps/ProtocolCard";
import UnknownContractRow from "@/components/apps/UnknownContractRow";

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 h-28 animate-pulse"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    />
  );
}

export default function AppsPageContent() {
  const { stxAddress, isConnected } = useWalletStore();
  const { data, isLoading, error, mutate } = useConnectedApps(
    stxAddress ?? undefined
  );

  const isEmpty =
    !data ||
    (data.knownProtocols.length === 0 && data.unknownContracts.length === 0);

  return (
    <>
      <Topbar title="Connected Apps" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          DeFi protocols and contracts you have interacted with on Stacks,
          based on your 50 most recent transactions.
        </p>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Globe size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Connect your wallet to see your app history
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Failed to load app history.
            </p>
            <button
              onClick={() => mutate()}
              className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--accent-dim)",
                color: "var(--accent)",
              }}
            >
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Globe size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No protocol interactions found in your recent transactions
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {data.knownProtocols.length > 0 && (
              <section>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Known Protocols
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.knownProtocols.map((p) => (
                    <ProtocolCard key={p.contractId} {...p} />
                  ))}
                </div>
              </section>
            )}
            {data.unknownContracts.length > 0 && (
              <section>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Unknown Contracts
                </h2>
                <div className="space-y-2">
                  {data.unknownContracts.map((c) => (
                    <UnknownContractRow key={c.contractId} {...c} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </AnimatedPage>
    </>
  );
}
