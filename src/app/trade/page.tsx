import Topbar from "@/components/layout/Topbar";
import SwapWidget from "@/components/trade/SwapWidget";
import MigrationWidget from "@/components/trade/MigrationWidget";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";
import MotionCard from "@/components/motion/MotionCard";
import { ArrowLeftRight, Zap, Shield, RefreshCw } from "lucide-react";

export default function TradePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Trade" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">

          {/* Swap Widget — full width */}
          <MotionCard className="glass-card rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-dim)' }}
              >
                <ArrowLeftRight size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Swap</h2>
            </div>
            <SwapWidget />
          </MotionCard>

          {/* aeUSDC ↔ USDCx Migration Widget */}
          <MotionCard className="glass-card rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
              >
                <RefreshCw size={15} className="text-blue-500" />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>aeUSDC → USDCx Migration</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Upgrade to native Circle USDC on Stacks</p>
              </div>
            </div>
            <MigrationWidget />
          </MotionCard>

          {/* Info panels — side by side below */}
          <MotionCard disableHover>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="glass-card rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={15} style={{ color: 'var(--accent)' }} />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Best Routes</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Aggregates multiple DEX pools to find the optimal swap path with lowest slippage.
                </p>
              </div>
              <div className="glass-card rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={15} className="text-orange-500" />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Real Yield</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Fees go directly to liquidity providers — no inflationary token rewards.
                </p>
              </div>
            </div>
          </MotionCard>

          {/* Swap Tips */}
          <MotionCard className="glass-card rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Swap Tips</h3>
            <ul className="space-y-2.5">
              {[
                "Set slippage to 0.5% for most swaps. Increase to 1% for low-liquidity tokens.",
                "Multi-hop routes (e.g. STX → USDA → ALEX) often give better rates than direct pairs.",
                "Check your HealthScore on the Assets tab to see which tokens to rebalance.",
                "Large trades may have higher price impact — consider splitting into smaller swaps.",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  >
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </MotionCard>

        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
