"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { SUPPORTED_PROTOCOLS } from "@/lib/protocol-positions";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import ProtocolCard from "@/components/apps/ProtocolCard";
import UnknownContractRow from "@/components/apps/UnknownContractRow";
import ExploreProtocolCard, { EXPLORE_PROTOCOLS } from "@/components/apps/ExploreProtocolCard";

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
  const t = useTranslations("apps");
  const { stxAddress, isConnected } = useWalletStore();
  const { data, isLoading, error, mutate } = useConnectedApps(
    stxAddress ?? undefined
  );
  const { data: positionsMap, isLoading: positionsLoading } = useProtocolPositions(
    stxAddress ?? undefined,
    data?.knownProtocols ?? []
  );

  const [showAllContracts, setShowAllContracts] = useState(false);

  const isEmpty =
    !data ||
    (data.knownProtocols.length === 0 && data.unknownContracts.length === 0);

  return (
    <>
      <Topbar title={t("title")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          {t("intro")}
        </p>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Globe size={40} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("connectPrompt")}
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
              {t("loadError")}
            </p>
            <button
              onClick={() => mutate()}
              className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--accent-dim)",
                color: "var(--accent)",
              }}
            >
              {t("retry")}
            </button>
          </div>
        ) : isEmpty ? (
          <section>
            <h2
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("exploreHeading")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXPLORE_PROTOCOLS.map((p) => (
                <ExploreProtocolCard key={p.name} {...p} />
              ))}
            </div>
          </section>
        ) : (
          <div className="space-y-8">
            {data.knownProtocols.length === 0 && (
              <section>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Explore DeFi on Stacks
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {EXPLORE_PROTOCOLS.map((p) => (
                    <ExploreProtocolCard key={p.name} {...p} />
                  ))}
                </div>
              </section>
            )}
            {data.knownProtocols.length > 0 && (
              <section>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("knownHeading")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.knownProtocols.map((p) => (
                    <ProtocolCard
                      key={p.contractId}
                      {...p}
                      position={
                        SUPPORTED_PROTOCOLS.has(p.name)
                          ? positionsLoading
                            ? "loading"
                            : (positionsMap?.get(p.name) ?? null)
                          : undefined
                      }
                    />
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
                  {t("unverifiedHeading")}
                </h2>
                <div className="space-y-2">
                  {(showAllContracts
                    ? data.unknownContracts
                    : data.unknownContracts.slice(0, 3)
                  ).map((c) => (
                    <UnknownContractRow key={c.contractId} {...c} />
                  ))}
                </div>
                {data.unknownContracts.length > 3 && (
                  <button
                    onClick={() => setShowAllContracts((v) => !v)}
                    className="mt-2 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ color: "var(--accent)" }}
                  >
                    {showAllContracts
                      ? t("showLess")
                      : t("showMore", { count: data.unknownContracts.length - 3 })}
                  </button>
                )}
              </section>
            )}
          </div>
        )}
      </AnimatedPage>
    </>
  );
}
