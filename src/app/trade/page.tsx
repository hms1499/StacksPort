import Topbar from "@/components/layout/Topbar";
import SwapWidget from "@/components/trade/SwapWidget";
import { ArrowLeftRight, Zap, Shield } from "lucide-react";

export default function TradePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Trade" />
      <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Swap Widget — full width */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <ArrowLeftRight size={15} className="text-teal-500" />
            </div>
            <h2 className="font-semibold text-gray-700">Swap</h2>
          </div>
          <SwapWidget />
        </div>

        {/* Info panels — side by side below */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-teal-500" />
              <h3 className="font-semibold text-gray-700 text-sm">Best Routes</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Aggregates multiple DEX pools to find the optimal swap path with lowest slippage.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-orange-500" />
              <h3 className="font-semibold text-gray-700 text-sm">Real Yield</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Fees go directly to liquidity providers — no inflationary token rewards.
            </p>
          </div>
        </div>

        {/* Swap Tips */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Swap Tips</h3>
          <ul className="space-y-2.5">
            {[
              "Set slippage to 0.5% for most swaps. Increase to 1% for low-liquidity tokens.",
              "Multi-hop routes (e.g. STX → USDA → ALEX) often give better rates than direct pairs.",
              "Check your HealthScore on the Assets tab to see which tokens to rebalance.",
              "Large trades may have higher price impact — consider splitting into smaller swaps.",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-gray-500">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
