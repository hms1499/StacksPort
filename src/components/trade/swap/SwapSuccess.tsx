import { CheckCircle2, ExternalLink } from "lucide-react";

export function SwapSuccess({
  fromSymbol,
  toSymbol,
  txId,
  network,
  onNewSwap,
}: {
  fromSymbol: string;
  toSymbol: string | undefined;
  txId: string;
  network: "mainnet" | "testnet";
  onNewSwap: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-10 gap-4 text-center">
      <CheckCircle2 size={52} className="text-green-500" />
      <div>
        <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Swap Submitted!
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {fromSymbol} → {toSymbol}
        </p>
      </div>
      <a
        href={`https://explorer.hiro.so/txid/${txId}?chain=${network}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm underline"
        style={{ color: 'var(--accent-text)' }}
      >
        View on Explorer <ExternalLink size={13} />
      </a>
      <button
        onClick={onNewSwap}
        className="mt-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
      >
        New Swap
      </button>
    </div>
  );
}
