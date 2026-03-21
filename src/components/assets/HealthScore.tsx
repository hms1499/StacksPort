"use client";

import { useMemo } from "react";
import { Lightbulb, Wallet } from "lucide-react";
import { TokenWithValue } from "@/lib/stacks";

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
  totalUsd: number
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
  const topVolToken = volatiles[0]?.symbol ?? "volatile assets";

  // ── Factor 1: Volatile Concentration (35 pts) ──────────────────────────────
  let cScore: number;
  let cLevel: Level;
  let cDesc: string;
  const topPct = (topVolAlloc * 100).toFixed(0);

  if (nV === 0) {
    cScore = 20; cLevel = "moderate";
    cDesc = "No volatile assets — no concentration risk";
  } else if (topVolAlloc > 0.9) {
    cScore = 0; cLevel = "poor";
    cDesc = `${topPct}% of volatile assets in ${topVolToken} — extreme`;
  } else if (topVolAlloc > 0.7) {
    cScore = 10; cLevel = "poor";
    cDesc = `${topPct}% of volatile assets in ${topVolToken} — high`;
  } else if (topVolAlloc > 0.5) {
    cScore = 22; cLevel = "moderate";
    cDesc = `${topPct}% of volatile assets in ${topVolToken} — moderate`;
  } else if (topVolAlloc > 0.3) {
    cScore = 30; cLevel = "moderate";
    cDesc = `${topPct}% in top volatile asset — manageable`;
  } else {
    cScore = 35; cLevel = "good";
    cDesc = `${topPct}% in top volatile asset — well spread`;
  }

  // ── Factor 2: Volatile Asset Count (25 pts) ────────────────────────────────
  let aScore: number;
  let aLevel: Level;
  let aDesc: string;

  if (nV === 0) {
    aScore = 0; aLevel = "poor";
    aDesc = "No volatile assets — portfolio is fully in stablecoins";
  } else if (nV === 1) {
    aScore = 5; aLevel = "poor";
    aDesc = "1 volatile asset — no diversification";
  } else if (nV === 2) {
    aScore = 12; aLevel = "poor";
    aDesc = "2 volatile assets — minimal diversification";
  } else if (nV <= 4) {
    aScore = 18; aLevel = "moderate";
    aDesc = `${nV} volatile assets — moderate diversification`;
  } else if (nV <= 7) {
    aScore = 22; aLevel = "good";
    aDesc = `${nV} volatile assets — good diversification`;
  } else {
    aScore = 25; aLevel = "good";
    aDesc = `${nV} volatile assets — excellent diversification`;
  }

  // ── Factor 3: Distribution quality / HHI (25 pts) ─────────────────────────
  let hScore: number;
  let hLevel: Level;
  let hDesc: string;

  if (nV === 0) {
    hScore = 5; hLevel = "poor";
    hDesc = "No volatile assets to distribute";
  } else if (volHHI > 0.8) {
    hScore = 0; hLevel = "poor";
    hDesc = "Highly concentrated volatile distribution";
  } else if (volHHI > 0.6) {
    hScore = 6; hLevel = "poor";
    hDesc = "Concentrated volatile distribution";
  } else if (volHHI > 0.4) {
    hScore = 13; hLevel = "moderate";
    hDesc = "Moderate balance among volatile assets";
  } else if (volHHI > 0.2) {
    hScore = 20; hLevel = "moderate";
    hDesc = "Good balance among volatile assets";
  } else {
    hScore = 25; hLevel = "good";
    hDesc = "Excellent balance among volatile assets";
  }

  // ── Factor 4: Stablecoin Reserve (15 pts) ─────────────────────────────────
  let sScore: number;
  let sLevel: Level;
  let sDesc: string;
  const sPct = (stablePct * 100).toFixed(0);

  if (stablePct > 0.6) {
    sScore = 3; sLevel = "poor";
    sDesc = `${sPct}% stablecoins — mostly cash, underdeployed`;
  } else if (stablePct > 0.3) {
    sScore = 10; sLevel = "moderate";
    sDesc = `${sPct}% stablecoins — cautious position`;
  } else if (stablePct > 0.05) {
    sScore = 15; sLevel = "good";
    sDesc = `${sPct}% stablecoins — healthy reserve`;
  } else if (stablePct > 0) {
    sScore = 12; sLevel = "good";
    sDesc = `${sPct}% stablecoins — small reserve`;
  } else {
    sScore = 8; sLevel = "moderate";
    sDesc = "No stablecoin reserve";
  }

  const total = cScore + aScore + hScore + sScore;

  // ── Label & color ──────────────────────────────────────────────────────────
  const { label, color } =
    total >= 86 ? { label: "Excellent",  color: "#22c55e" } :
    total >= 71 ? { label: "Good",       color: "#84cc16" } :
    total >= 51 ? { label: "Moderate",   color: "#eab308" } :
    total >= 31 ? { label: "Needs Work", color: "#f97316" } :
                  { label: "Unbalanced", color: "#ef4444" };

  // ── Tip ────────────────────────────────────────────────────────────────────
  let tip: string;
  if (nV === 0)
    tip = `Your portfolio is ${sPct}% stablecoins with no volatile assets. Consider deploying into Stacks ecosystem tokens like STX, ALEX, or Velar.`;
  else if (stablePct > 0.6)
    tip = `${sPct}% of your portfolio is in stablecoins. A large cash position is safe but limits growth exposure.`;
  else if (topVolAlloc > 0.9)
    tip = `${topPct}% of your volatile allocation is in ${topVolToken}. Even small positions in 2–3 other Stacks tokens would significantly reduce concentration risk.`;
  else if (nV === 1)
    tip = `You hold only 1 volatile asset (${topVolToken}). Adding 2–3 more Stacks ecosystem tokens (e.g. ALEX, sBTC, Velar) would improve your score quickly.`;
  else if (topVolAlloc > 0.7)
    tip = `${topVolToken} makes up ${topPct}% of your volatile portfolio. Gradually rebalancing into other assets could lower your concentration risk.`;
  else if (stablePct === 0 && nV > 0)
    tip = `No stablecoin reserve detected. Holding 5–15% in a stablecoin like USDCx provides a buffer during market downturns.`;
  else if (total >= 80)
    tip = "Your portfolio shows healthy diversification across the Stacks ecosystem. Keep maintaining a balanced allocation.";
  else
    tip = "Consider gradually rebalancing volatile assets to spread weight more evenly and maintain a stablecoin reserve.";

  return {
    score: total,
    label,
    color,
    stablePct,
    volatilePct,
    metrics: [
      { label: "Volatile Concentration", score: cScore, maxScore: 35, description: cDesc, level: cLevel },
      { label: "Asset Count",            score: aScore, maxScore: 25, description: aDesc, level: aLevel },
      { label: "Distribution Quality",   score: hScore, maxScore: 25, description: hDesc, level: hLevel },
      { label: "Stablecoin Reserve",     score: sScore, maxScore: 15, description: sDesc, level: sLevel },
    ],
    tip,
  };
}

// ─── UI components ────────────────────────────────────────────────────────────

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
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
          fill="#111827" fontFamily="system-ui, sans-serif">{score}</text>
        <text x="62" y="73" textAnchor="middle" fontSize="11"
          fill="#9ca3af" fontFamily="system-ui, sans-serif">/ 100</text>
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
        <p className="text-xs font-medium text-gray-600">{metric.label}</p>
        <p className={`text-xs font-bold tabular-nums ${text}`}>
          {metric.score}
          <span className="text-gray-300 font-normal">/{metric.maxScore}</span>
        </p>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">{metric.description}</p>
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
  const result = useMemo(
    () => (stx && totalUsd > 0 ? calcHealth(stx, tokens, totalUsd) : null),
    [stx, tokens, totalUsd]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-44 mb-5" />
        <div className="flex gap-8">
          <div className="w-32 h-32 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-4 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-28" />
                <div className="h-1.5 bg-gray-100 rounded-full" />
                <div className="h-3 bg-gray-100 rounded w-40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stx || totalUsd === 0 || !result) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center py-10 text-center">
        <Wallet size={32} className="text-gray-200 mb-3" />
        <p className="text-sm text-gray-400">Connect your wallet to see your health score</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-700">Portfolio Health Score</h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-teal-400 mr-1" />
            Volatile {(result.volatilePct * 100).toFixed(0)}%
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-300 mr-1" />
            Stable {(result.stablePct * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="flex gap-8 items-center">
        {/* Score ring */}
        <div className="flex-shrink-0">
          <ScoreRing score={result.score} color={result.color} label={result.label} />
        </div>

        {/* Metrics */}
        <div className="flex-1 space-y-3.5">
          {result.metrics.map((m) => (
            <MetricRow key={m.label} metric={m} />
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="mt-5 flex items-start gap-2.5 bg-gray-50 rounded-xl px-4 py-3">
        <Lightbulb size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">{result.tip}</p>
      </div>
    </div>
  );
}
