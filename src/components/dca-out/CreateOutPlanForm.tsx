"use client";

import { useState, useEffect } from "react";
import { PlusCircle, Info, AlertTriangle } from "lucide-react";
import {
  createSBTCPlan,
  SBTC_INTERVALS,
  btcToSats,
  satsToBTC,
  SBTC_TARGET_TOKENS,
  getSBTCBalance,
} from "@/lib/dca-sbtc";
import { useWalletStore } from "@/store/walletStore";
import { useNotificationStore } from "@/store/notificationStore";

const USDCX = SBTC_TARGET_TOKENS[0].value;

interface Props {
  onCreated: () => void;
}

export default function CreateOutPlanForm({ onCreated }: Props) {
  const { stxAddress } = useWalletStore();
  const { addNotification } = useNotificationStore();
  const [amountPerSwap, setAmountPerSwap] = useState("");
  const [interval, setInterval] = useState<keyof typeof SBTC_INTERVALS>("Weekly");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sbtcBalance, setSbtcBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!stxAddress) return;
    getSBTCBalance(stxAddress).then((sats) => setSbtcBalance(satsToBTC(sats)));
  }, [stxAddress]);

  const amt = parseFloat(amountPerSwap) || 0;
  const dep = parseFloat(initialDeposit) || 0;
  const maxDeposit = sbtcBalance != null ? Math.max(0, Math.floor(sbtcBalance * 1e8 - 1) / 1e8) : 0;
  const insufficientBalance = sbtcBalance != null && dep > sbtcBalance;

  const validate = (): string | null => {
    if (btcToSats(amt) < 20) return "Minimum 20 satoshis per swap (0.0000002 sBTC)";
    if (btcToSats(dep) < 40) return "Minimum deposit 40 satoshis";
    if (dep < amt) return "Initial deposit must be ≥ amount per swap";
    if (insufficientBalance)
      return `Insufficient sBTC. Current balance: ${sbtcBalance?.toFixed(8)} sBTC`;
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) {
      setError(err);
      addNotification(err, "error", "dca-out", 5000);
      return;
    }
    setError(null);
    setLoading(true);

    createSBTCPlan(
      USDCX,
      btcToSats(amt),
      SBTC_INTERVALS[interval],
      btcToSats(dep),
      ({ txId }) => {
        setTxId(txId);
        setLoading(false);
        addNotification(
          `Plan created! Tx: ${txId.slice(0, 10)}...`,
          "success",
          "dca-out",
          5000,
          { txId, action: "created", amount: String(amt), tokenSymbol: "USDCx" }
        );
        onCreated();
      },
      () => {
        setLoading(false);
        addNotification("Failed to create plan", "error", "dca-out", 5000);
      }
    );
  };

  if (txId) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
          <PlusCircle size={18} className="text-teal-500" />
        </div>
        <p className="font-semibold text-gray-900">Plan submitted!</p>
        <p className="text-xs text-gray-400 break-all">Tx: {txId}</p>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Plan will appear after the transaction is confirmed (~1-2 min). Click refresh to update.
        </p>
        <button
          onClick={() => {
            setTxId(null);
            setAmountPerSwap("");
            setInitialDeposit("");
          }}
          className="mt-1 text-sm text-teal-600 hover:underline text-left"
        >
          + Create new plan
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-gray-900">Create DCA Out Plan</h2>

      {/* Source token (fixed = sBTC) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Spend (Source Token)</label>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <span className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            &#8383;
          </span>
          <span className="text-sm font-semibold text-gray-900">sBTC</span>
          <span className="text-xs text-gray-400 ml-auto">Bitcoin on Stacks</span>
        </div>
      </div>

      {/* Target token — fixed to USDCx */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Buy (Target Token)</label>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            $
          </span>
          <span className="text-sm font-semibold text-gray-900">USDCx</span>
          <span className="text-xs text-gray-400 ml-auto">USD Coin on Stacks</span>
        </div>
      </div>

      {/* Amount per swap */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Amount per Swap</label>
        <div className="relative">
          <input
            type="number"
            value={amountPerSwap}
            onChange={(e) => setAmountPerSwap(e.target.value)}
            placeholder="0.0001"
            step="0.00000001"
            min="0.0000002"
            className="w-full px-3 py-2.5 pr-14 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
            sBTC
          </span>
        </div>
      </div>

      {/* Interval */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Interval</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SBTC_INTERVALS) as (keyof typeof SBTC_INTERVALS)[]).map((key) => (
            <button
              key={key}
              onClick={() => setInterval(key)}
              className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                interval === key
                  ? "bg-teal-500 text-white border-teal-500"
                  : "border-gray-200 text-gray-500 hover:border-teal-300"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Initial deposit */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500">Initial Deposit</label>
          {sbtcBalance != null && (
            <span className="text-xs text-gray-400">
              Balance:{" "}
              <span
                className={
                  insufficientBalance ? "text-red-500 font-medium" : "text-gray-600 font-medium"
                }
              >
                {sbtcBalance.toFixed(8)} sBTC
              </span>
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            value={initialDeposit}
            onChange={(e) => setInitialDeposit(e.target.value)}
            placeholder="0.0002"
            step="0.00000001"
            min="0.0000004"
            className={`w-full px-3 py-2.5 pr-20 rounded-xl border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
              insufficientBalance ? "border-red-300 bg-red-50" : "border-gray-200"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {sbtcBalance != null && (
              <button
                type="button"
                onClick={() => setInitialDeposit(String(maxDeposit))}
                className="text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded hover:bg-teal-100 transition-colors"
              >
                Max
              </button>
            )}
            <span className="text-xs font-medium text-gray-400">sBTC</span>
          </div>
        </div>
        {insufficientBalance && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle size={11} /> Insufficient sBTC in wallet
          </p>
        )}
        {!insufficientBalance && amt > 0 && dep >= amt && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Info size={11} />~{Math.floor(dep / amt)} swaps
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <PlusCircle size={16} />
        {loading ? "Waiting for wallet..." : "Create Plan"}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        Mainnet · 0.3% protocol fee per swap · 3-hop swap via Bitflow
      </p>
    </div>
  );
}
