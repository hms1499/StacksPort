"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Check, Copy } from "lucide-react";
import { DCA_CONTRACT_ADDRESS, DCA_CONTRACT_NAME } from "@/lib/dca";
import { shortenAddress } from "@/lib/utils";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "v0.1";

export default function DashboardFooter() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`${DCA_CONTRACT_ADDRESS}.${DCA_CONTRACT_NAME}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <footer
      className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px]"
      style={{ color: 'var(--text-muted)' }}
    >
      <span>Powered by</span>
      <Link
        href="https://www.stacks.co"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold transition-colors hover:text-[var(--accent)]"
      >
        Stacks
      </Link>
      <span style={{ color: 'var(--border-default)' }}>·</span>
      <span className="font-data">{VERSION}</span>
      <span style={{ color: 'var(--border-default)' }}>·</span>
      <Link
        href={`https://explorer.hiro.so/txid/${DCA_CONTRACT_ADDRESS}.${DCA_CONTRACT_NAME}?chain=mainnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-data transition-colors hover:text-[var(--accent)]"
        title={`${DCA_CONTRACT_ADDRESS}.${DCA_CONTRACT_NAME}`}
      >
        contract {shortenAddress(DCA_CONTRACT_ADDRESS)}
      </Link>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy contract address"
        className="inline-flex items-center transition-colors hover:text-[var(--accent)]"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </footer>
  );
}
