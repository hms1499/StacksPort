"use client";

import { useState, useEffect } from "react";
import { PlusCircle, Info, AlertTriangle } from "lucide-react";
import { createPlan, INTERVALS, stxToMicro, microToSTX, TARGET_TOKENS, getTestnetSTXBalance } from "@/lib/dca";
import { useWalletStore } from "@/store/walletStore";

interface Props {
  onCreated: () => void;
}

export default function CreatePlanForm({ onCreated }: Props) {
  const { stxAddress } = useWalletStore();
  const [targetToken, setTargetToken] = useState("");
  const [amountPerSwap, setAmountPerSwap] = useState("");
  const [interval, setInterval] = useState<keyof typeof INTERVALS>("Weekly");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stxBalance, setStxBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!stxAddress) return;
    getTestnetSTXBalance(stxAddress).then((bal) => setStxBalance(microToSTX(bal)));
  }, [stxAddress]);

  const amt = parseFloat(amountPerSwap) || 0;
  const dep = parseFloat(initialDeposit) || 0;
  const maxDeposit = stxBalance != null ? Math.max(0, Math.floor((stxBalance - 0.01) * 100) / 100) : 0;
  const insufficientBalance = stxBalance != null && dep > stxBalance;

  const validate = (): string | null => {
    if (!targetToken.trim()) return "Chọn hoặc nhập target token";
    if (amt < 1) return "Minimum 1 STX per swap";
    if (dep < 2) return "Minimum deposit 2 STX";
    if (dep < amt) return "Initial deposit phải >= amount per swap";
    if (insufficientBalance) return `Không đủ STX. Số dư hiện tại: ${stxBalance?.toFixed(2)} STX`;
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);

    createPlan(
      targetToken.trim(),
      stxToMicro(amt),
      INTERVALS[interval],
      stxToMicro(dep),
      ({ txId }) => { setTxId(txId); setLoading(false); onCreated(); },
      () => setLoading(false)
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
          Plan sẽ hiển thị sau khi transaction được confirm (~1-2 phút). My Plans tự động refresh mỗi 30s.
        </p>
        <button
          onClick={() => { setTxId(null); setTargetToken(""); setAmountPerSwap(""); setInitialDeposit(""); }}
          className="mt-1 text-sm text-teal-600 hover:underline text-left"
        >
          + Tạo plan mới
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-gray-900">Tạo DCA Plan</h2>

      {/* Source token (fixed = STX) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Spend (Source Token)</label>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <span className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            S
          </span>
          <span className="text-sm font-semibold text-gray-900">STX</span>
          <span className="text-xs text-gray-400 ml-auto">Native Stacks token</span>
        </div>
      </div>

      {/* Target token */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Buy (Target Token)</label>
        <input
          type="text"
          value={targetToken}
          onChange={(e) => setTargetToken(e.target.value)}
          placeholder="SP…contract.token-name"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <div className="flex gap-2 flex-wrap mt-0.5">
          {TARGET_TOKENS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTargetToken(t.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                targetToken === t.value
                  ? "bg-teal-500 text-white border-teal-500"
                  : "border-gray-200 text-gray-500 hover:border-teal-300 hover:text-teal-600"
              }`}
            >
              {t.label}
            </button>
          ))}
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
            placeholder="1"
            min="1"
            className="w-full px-3 py-2.5 pr-14 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">STX</span>
        </div>
      </div>

      {/* Interval */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500">Interval</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(INTERVALS) as (keyof typeof INTERVALS)[]).map((key) => (
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
          {stxBalance != null && (
            <span className="text-xs text-gray-400">
              Số dư:{" "}
              <span className={insufficientBalance ? "text-red-500 font-medium" : "text-gray-600 font-medium"}>
                {stxBalance.toFixed(2)} STX
              </span>
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            value={initialDeposit}
            onChange={(e) => setInitialDeposit(e.target.value)}
            placeholder="2"
            min="2"
            className={`w-full px-3 py-2.5 pr-20 rounded-xl border text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
              insufficientBalance ? "border-red-300 bg-red-50" : "border-gray-200"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {stxBalance != null && (
              <button
                type="button"
                onClick={() => setInitialDeposit(String(maxDeposit))}
                className="text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded hover:bg-teal-100 transition-colors"
              >
                Max
              </button>
            )}
            <span className="text-xs font-medium text-gray-400">STX</span>
          </div>
        </div>
        {insufficientBalance && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle size={11} /> Không đủ STX trong ví testnet
          </p>
        )}
        {!insufficientBalance && amt > 0 && dep >= amt && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Info size={11} />~{Math.floor(dep / amt)} lần swap
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
        {loading ? "Chờ ví xác nhận…" : "Tạo Plan"}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        Testnet · 0.3% protocol fee mỗi swap
      </p>
    </div>
  );
}
