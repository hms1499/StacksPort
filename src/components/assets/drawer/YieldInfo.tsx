"use client";

import { useRouter } from "@/i18n/navigation";
import { ExternalLink, Lock, Bitcoin, ArrowUpRight } from "lucide-react";
import { useSBTCDataSnap } from "@/hooks/usePortfolioSnapshot";
import { useWalletStore } from "@/store/walletStore";
import { type TokenWithValue } from "@/lib/stacks";

function StSTXYieldCard({ token }: { token: TokenWithValue }) {
  // APY range mirrors YieldOpportunities — labelled "Estimated".
  const estApy = "7–9%";
  const stakedStxEquiv = token.balance > 0 ? token.balance : null; // ~1:1 receipt-to-STX claim

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid rgba(167, 139, 250, 0.25)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(167, 139, 250, 0.15)", color: "#A78BFA" }}
          >
            <Lock size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Liquid Stacking
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              via StackingDAO
            </p>
          </div>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: "#A78BFA" }}>
          ~{estApy}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        stSTX accrues PoX rewards automatically — its claim on STX grows each cycle.
        {stakedStxEquiv != null && (
          <>
            {" "}
            You hold ~<span className="font-mono">{stakedStxEquiv.toFixed(2)}</span> stSTX.
          </>
        )}
      </p>

      <div className="flex gap-2">
        <a
          href="https://stackingdao.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors"
          style={{ backgroundColor: "rgba(167, 139, 250, 0.15)", color: "#A78BFA" }}
        >
          Manage on StackingDAO <ExternalLink size={11} />
        </a>
      </div>

      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
        APY estimate · varies by cycle
      </p>
    </div>
  );
}

function SBTCYieldCard() {
  const { stxAddress, isConnected } = useWalletStore();
  const router = useRouter();
  const { data: sbtc } = useSBTCDataSnap(
    isConnected && stxAddress ? stxAddress : undefined
  );

  const status = sbtc?.peg?.status ?? null;
  const deviation = sbtc?.peg?.deviation ?? null;
  const pegColor =
    status === "pegged" ? "#22C55E" : status === "slight" ? "#F59E0B" : status === "depegged" ? "#EF4444" : "var(--text-muted)";
  const pegLabel =
    status === "pegged"
      ? "Pegged"
      : status === "slight"
        ? "Slight drift"
        : status === "depegged"
          ? "Depegged"
          : "—";

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid rgba(247, 147, 26, 0.25)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(247, 147, 26, 0.15)", color: "#F7931A" }}
          >
            <Bitcoin size={14} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              sBTC Liquidity
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Bitflow / ALEX pools
            </p>
          </div>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: "#F7931A" }}>
          ~3–5%
        </span>
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <span style={{ color: "var(--text-muted)" }}>Peg status</span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: pegColor }}
          />
          <span className="font-medium" style={{ color: pegColor }}>
            {pegLabel}
          </span>
          {deviation != null && Math.abs(deviation) >= 0.01 && (
            <span className="font-mono" style={{ color: "var(--text-muted)" }}>
              ({deviation > 0 ? "+" : ""}
              {deviation.toFixed(2)}%)
            </span>
          )}
        </span>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        sBTC isn&apos;t yield-bearing on its own — supplying it to a DEX pool earns swap fees.
      </p>

      <button
        type="button"
        onClick={() => router.push("/trade?from=sbtc")}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-colors"
        style={{ backgroundColor: "rgba(247, 147, 26, 0.15)", color: "#F7931A" }}
      >
        Explore sBTC pools <ArrowUpRight size={11} />
      </button>

      <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
        APY estimate · pool depth dependent
      </p>
    </div>
  );
}

export default function YieldInfo({ token }: { token: TokenWithValue }) {
  const isStSTX =
    token.symbol === "stSTX" ||
    (token.contractId?.split("::")[0].split(".")[1] === "ststx-token");
  const isSBTC =
    token.symbol === "sBTC" ||
    (token.contractId?.split("::")[0].split(".")[1] === "sbtc-token");

  if (!isStSTX && !isSBTC) return null;

  return (
    <div className="p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <p
        className="text-xs uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Yield
      </p>
      {isStSTX ? <StSTXYieldCard token={token} /> : <SBTCYieldCard />}
    </div>
  );
}
