"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sprout } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { connectWallet } from "@/lib/wallet";

/**
 * Single connect CTA for the disconnected /earn page. Replaces the three
 * separate per-card "connect your wallet" prompts (hero, positions,
 * stacking tracker) that otherwise stack up when signed out.
 */
export default function EarnConnectBanner() {
  const t = useTranslations("earn.connect");
  const tc = useTranslations("common");
  const { connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      await connectWallet(connect);
    } catch {
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col items-center text-center gap-4 shadow-sm">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}
      >
        <Sprout size={26} />
      </div>
      <div className="max-w-md">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
        <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
          {t("body")}
        </p>
      </div>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
        style={{ background: "var(--accent)", color: "#04130d" }}
      >
        {connecting ? tc("connecting") : t("cta")}
      </button>
    </div>
  );
}
