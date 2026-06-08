"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, Wallet } from "lucide-react";
import { TokenWithValue } from "@/lib/stacks";
import { useThemeStore } from "@/store/themeStore";

type HealthT = ReturnType<typeof useTranslations<"assets.health">>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Level = "good" | "moderate" | "poor";

function isStablecoin(t: TokenWithValue): boolean {
  const sym = t.symbol.toUpperCase();
  return (
    sym.includes("USD") ||
    sym === "DAI" ||
    sym === "BUSD" ||
    sym === "USDC" ||
    sym === "USDT"
  );
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  score: number;
  maxScore: number;
  description: string;
  level: Level;
}

interface HealthResult {
  score: number;
  label: string;
  color: string;
  metrics: Metric[];
  tip: string;
  stablePct: number;
  volatilePct: number;
}

function calcHealth(
  stx: TokenWithValue,
  tokens: TokenWithValue[],
  totalUsd: number,
  t: HealthT
): HealthResult {
  const allAssets = [stx, ...tokens.filter((t) => t.valueUsd > 0)];

  const stables = allAssets.filter(isStablecoin);
  const volatiles = allAssets.filter((t) => !isStablecoin(t));

  const stableUsd = stables.reduce((s, t) => s + t.valueUsd, 0);
  const volatileUsd = volatiles.reduce((s, t) => s + t.valueUsd, 0);
  const stablePct = stableUsd / totalUsd;
  const volatilePct = volatileUsd / totalUsd;

  const nV = volatiles.length;
  const volAllocs = volatileUsd > 0
    ? volatiles.map((t) => t.valueUsd / volatileUsd)
    : [];
  const topVolAlloc = volAllocs.length > 0 ? Math.max(...volAllocs) : 0;
  const volHHI = volAllocs.reduce((s, a) => s + a * a, 0);
  const topVolToken = volatiles[0]?.symbol ?? t("fallbackToken");

  // ── Factor 1: Volatile Concentration (35 pts) ──────────────────────────────
  let cScore: number;
  let cLevel: Level;
  let cDesc: string;
  const topPct = (topVolAlloc * 100).toFixed(0);

  if (nV === 0) {
    cScore = 20; cLevel = "moderate";
    cDesc = t("cNone");
  } else if (topVolAlloc > 0.9) {
    cScore = 0; cLevel = "poor";
    cDesc = t("cExtreme", { pct: topPct, token: topVolToken });
  } else if (topVolAlloc > 0.7) {
    cScore = 10; cLevel = "poor";
    cDesc = t("cHigh", { pct: topPct, token: topVolToken });
  } else if (topVolAlloc > 0.5) {
    cScore = 22; cLevel = "moderate";
    cDesc = t("cModerate", { pct: topPct, token: topVolToken });
  } else if (topVolAlloc > 0.3) {
    cScore = 30; cLevel = "moderate";
    cDesc = t("cManageable", { pct: topPct });
  } else {
    cScore = 35; cLevel = "good";
    cDesc = t("cWellSpread", { pct: topPct });
  }

  // ── Factor 2: Volatile Asset Count (25 pts) ────────────────────────────────
  let aScore: number;
  let aLevel: Level;
  let aDesc: string;

  if (nV === 0) {
    aScore = 0; aLevel = "poor";
    aDesc = t("aNone");
  } else if (nV === 1) {
    aScore = 5; aLevel = "poor";
    aDesc = t("aOne");
  } else if (nV === 2) {
    aScore = 12; aLevel = "poor";
    aDesc = t("aTwo");
  } else if (nV <= 4) {
    aScore = 18; aLevel = "moderate";
    aDesc = t("aModerate", { n: nV });
  } else if (nV <= 7) {
    aScore = 22; aLevel = "good";
    aDesc = t("aGood", { n: nV });
  } else {
    aScore = 25; aLevel = "good";
    aDesc = t("aExcellent", { n: nV });
  }

  // ── Factor 3: Distribution quality / HHI (25 pts) ─────────────────────────
  let hScore: number;
  let hLevel: Level;
  let hDesc: string;

  if (nV === 0) {
    hScore = 5; hLevel = "poor";
    hDesc = t("hNone");
  } else if (volHHI > 0.8) {
    hScore = 0; hLevel = "poor";
    hDesc = t("hHighlyConcentrated");
  } else if (volHHI > 0.6) {
    hScore = 6; hLevel = "poor";
    hDesc = t("hConcentrated");
  } else if (volHHI > 0.4) {
    hScore = 13; hLevel = "moderate";
    hDesc = t("hModerate");
  } else if (volHHI > 0.2) {
    hScore = 20; hLevel = "moderate";
    hDesc = t("hGood");
  } else {
    hScore = 25; hLevel = "good";
    hDesc = t("hExcellent");
  }

  // ── Factor 4: Stablecoin Reserve (15 pts) ─────────────────────────────────
  let sScore: number;
  let sLevel: Level;
  let sDesc: string;
  const sPct = (stablePct * 100).toFixed(0);

  if (stablePct > 0.6) {
    sScore = 3; sLevel = "poor";
    sDesc = t("sMostlyCash", { pct: sPct });
  } else if (stablePct > 0.3) {
    sScore = 10; sLevel = "moderate";
    sDesc = t("sCautious", { pct: sPct });
  } else if (stablePct > 0.05) {
    sScore = 15; sLevel = "good";
    sDesc = t("sHealthy", { pct: sPct });
  } else if (stablePct > 0) {
    sScore = 12; sLevel = "good";
    sDesc = t("sSmall", { pct: sPct });
  } else {
    sScore = 8; sLevel = "moderate";
    sDesc = t("sNone");
  }

  const total = cScore + aScore + hScore + sScore;

  // ── Label & color ──────────────────────────────────────────────────────────
  const { label, color } =
    total >= 86 ? { label: t("levelExcellent"),  color: "#22c55e" } :
    total >= 71 ? { label: t("levelGood"),       color: "#84cc16" } :
    total >= 51 ? { label: t("levelModerate"),   color: "#eab308" } :
    total >= 31 ? { label: t("levelNeedsWork"),  color: "#f97316" } :
                  { label: t("levelUnbalanced"), color: "#ef4444" };

  // ── Tip ────────────────────────────────────────────────────────────────────
  let tip: string;
  if (nV === 0)
    tip = t("tipNoVolatile", { pct: sPct });
  else if (stablePct > 0.6)
    tip = t("tipMostlyStable", { pct: sPct });
  else if (topVolAlloc > 0.9)
    tip = t("tipExtremeConc", { pct: topPct, token: topVolToken });
  else if (nV === 1)
    tip = t("tipOneAsset", { token: topVolToken });
  else if (topVolAlloc > 0.7)
    tip = t("tipHighConc", { token: topVolToken, pct: topPct });
  else if (stablePct === 0 && nV > 0)
    tip = t("tipNoStable");
  else if (total >= 80)
    tip = t("tipHealthy");
  else
    tip = t("tipDefault");

  return {
    score: total,
    label,
    color,
    stablePct,
    volatilePct,
    metrics: [
      { label: t("mVolatileConcentration"), score: cScore, maxScore: 35, description: cDesc, level: cLevel },
      { label: t("mAssetCount"),            score: aScore, maxScore: 25, description: aDesc, level: aLevel },
      { label: t("mDistributionQuality"),   score: hScore, maxScore: 25, description: hDesc, level: hLevel },
      { label: t("mStablecoinReserve"),     score: sScore, maxScore: 15, description: sDesc, level: sLevel },
    ],
    tip,
  };
}

// ─── UI components ────────────────────────────────────────────────────────────

function ScoreRing({ score, color, label, isDark }: { score: number; color: string; label: string; isDark: boolean }) {
  const t = useTranslations("assets.health");
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const trackColor = isDark ? "#1e3a52" : "#f3f4f6";
  const textPrimary = isDark ? "#f3f4f6" : "#111827";
  const textMuted = isDark ? "#6b7280" : "#9ca3af";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={r} fill="none" stroke={trackColor} strokeWidth="10" />
        <circle
          cx="62" cy="62" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 62 62)"
        />
        <text x="62" y="56" textAnchor="middle" fontSize="30" fontWeight="bold"
          fill={textPrimary} fontFamily="system-ui, sans-serif">{score}</text>
        <text x="62" y="73" textAnchor="middle" fontSize="11"
          fill={textMuted} fontFamily="system-ui, sans-serif">{t("outOf")}</text>
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

const LEVEL_STYLES: Record<Level, { bar: string; text: string }> = {
  good:     { bar: "bg-green-400",  text: "text-green-500" },
  moderate: { bar: "bg-yellow-400", text: "text-yellow-500" },
  poor:     { bar: "bg-red-400",    text: "text-red-500" },
};

function MetricRow({ metric }: { metric: Metric }) {
  const pct = (metric.score / metric.maxScore) * 100;
  const { bar, text } = LEVEL_STYLES[metric.level];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{metric.label}</p>
        <p className={`text-xs font-bold tabular-nums ${text}`}>
          {metric.score}
          <span className="font-normal" style={{ color: 'var(--border-default)' }}>/{metric.maxScore}</span>
        </p>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{metric.description}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  stx: TokenWithValue | null;
  tokens: TokenWithValue[];
  totalUsd: number;
  loading: boolean;
}

export default function HealthScore({ stx, tokens, totalUsd, loading }: Props) {
  const t = useTranslations("assets.health");
  const isDark = useThemeStore((s) => s.theme === "dark");
  const result = useMemo(
    () => (stx && totalUsd > 0 ? calcHealth(stx, tokens, totalUsd, t) : null),
    [stx, tokens, totalUsd, t]
  );
  const s = { backgroundColor: 'var(--border-subtle)' } as const;

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 rounded w-44 mb-5" style={s} />
        <div className="flex gap-8">
          <div className="w-32 h-32 rounded-full shrink-0" style={s} />
          <div className="flex-1 space-y-4 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 rounded w-28" style={s} />
                <div className="h-1.5 rounded-full" style={s} />
                <div className="h-3 rounded w-40" style={s} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stx || totalUsd === 0 || !result) {
    return (
      <div className="glass-card rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center py-10 text-center">
        <Wallet size={32} className="mb-3" style={{ color: 'var(--border-default)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t("connectMsg")}</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t("title")}</h2>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#B0E4CC] mr-1" />
            {t("volatile", { pct: (result.volatilePct * 100).toFixed(0) })}
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-300 mr-1" />
            {t("stable", { pct: (result.stablePct * 100).toFixed(0) })}
          </span>
        </div>
      </div>

      <div className="flex gap-8 items-center">
        {/* Score ring */}
        <div className="shrink-0">
          <ScoreRing score={result.score} color={result.color} label={result.label} isDark={isDark} />
        </div>

        {/* Metrics */}
        <div className="flex-1 space-y-3.5">
          {result.metrics.map((m) => (
            <MetricRow key={m.label} metric={m} />
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="mt-5 flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <Lightbulb size={14} className="text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{result.tip}</p>
      </div>
    </div>
  );
}
