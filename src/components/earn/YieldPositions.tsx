"use client";

import { useTranslations } from "next-intl";
import { useWalletStore } from "@/store/walletStore";
import { useConnectedApps, useProtocolPositions } from "@/hooks/useMarketData";
import { useYieldSnapshot } from "@/hooks/useYieldSnapshot";

function symbolOf(tokenAmount: string): string {
  const parts = tokenAmount.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toUpperCase();
}

// Below this APY (percent) the badge reads as broken ("0.01% APY") rather than
// informative — hide it instead of showing a near-zero figure.
const MIN_DISPLAY_APY = 0.05;

export default function YieldPositions() {
  const t = useTranslations("earn.positions");
  const { stxAddress, isConnected } = useWalletStore();
  const addr = isConnected && stxAddress ? stxAddress : undefined;
  const { data: apps, isLoading: appsLoading } = useConnectedApps(addr);
  const { data: positionsMap, isLoading: positionsLoading } = useProtocolPositions(
    addr,
    apps?.knownProtocols ?? []
  );
  const { data: yieldSnap } = useYieldSnapshot();

  const entries = positionsMap
    ? Array.from(positionsMap.entries()).filter(([, pos]) => pos && pos.totalUsd > 0)
    : [];
  // Distinguish "still fetching" from "genuinely empty" so a connected user with
  // positions never sees the empty copy flash before data arrives.
  const loading = appsLoading || positionsLoading;

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3
        className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: "var(--text-muted)", letterSpacing: "0.1em" }}
      >
        {t("header")}
      </h3>

      {!isConnected ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("connectPrompt")}</p>
      ) : loading ? (
        <ul className="space-y-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="h-3 w-28 rounded skeleton" />
              <div className="h-3 w-16 rounded skeleton" />
            </li>
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map(([name, pos]) => (
            <li key={name}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{name}</p>
                <p className="text-sm font-bold font-data" style={{ color: "var(--text-primary)" }}>
                  ${pos!.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <ul className="mt-1 space-y-0.5" aria-label={name}>
                {pos!.lines.map((line) => {
                  const zestApy =
                    name === "Zest Protocol"
                      ? yieldSnap?.zest?.[symbolOf(line.tokenAmount)]
                      : undefined;
                  return (
                    <li
                      key={`${line.label}-${line.tokenAmount}`}
                      className="flex items-center justify-between text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{line.label}: {line.tokenAmount}</span>
                      {typeof zestApy === "number" && zestApy >= MIN_DISPLAY_APY && (
                        <span
                          className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ color: "var(--accent)", backgroundColor: "var(--accent-dim)" }}
                        >
                          {t("apy", { value: zestApy.toFixed(2) })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
