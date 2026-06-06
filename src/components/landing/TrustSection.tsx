import { Bot, ExternalLink, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import {
  DCA_CONTRACT_ID,
  DCA_SBTC_CONTRACT_ID,
  mainnetContractExplorerUrl,
} from "@/lib/dca-contracts";

const TRUST_POINTS = [
  {
    icon: KeyRound,
    title: "You keep control",
    description:
      "Wallet approval is required for deposits and plan changes. StacksPort never receives your seed phrase or private key.",
  },
  {
    icon: Bot,
    title: "Automated on-chain",
    description:
      "A keeper submits due executions, while the vault contracts enforce plan balances, intervals, and swap accounting.",
  },
  {
    icon: RotateCcw,
    title: "Pause or cancel",
    description:
      "Plans remain under your wallet's control. Pause future executions or cancel and withdraw the remaining vault balance.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent fees",
    description:
      "Each automated swap charges a 0.3% protocol fee. Network and DEX execution costs are separate.",
  },
] as const;

const CONTRACTS = [
  { label: "STX to sBTC vault", id: DCA_CONTRACT_ID },
  { label: "sBTC to USDCx vault", id: DCA_SBTC_CONTRACT_ID },
] as const;

function shortenContract(contractId: string): string {
  const [address, name] = contractId.split(".");
  return `${address.slice(0, 6)}...${address.slice(-4)}.${name}`;
}

export default function TrustSection() {
  return (
    <section
      id="security"
      aria-labelledby="trust-heading"
      className="px-5 py-24 md:px-8"
      style={{ borderTop: "1px solid rgba(28,49,80,0.6)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#00E5A0", letterSpacing: "0.12em" }}
          >
            Verify, don&apos;t trust
          </p>
          <h2
            id="trust-heading"
            className="text-4xl font-bold md:text-5xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            Built for transparent automation
          </h2>
          <p
            className="mt-5 text-base leading-relaxed"
            style={{ color: "rgba(221,232,248,0.5)" }}
          >
            The automation runs through open-source contracts deployed on
            Stacks mainnet. Review the rules and live contract activity before
            connecting a wallet.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="landing-card rounded-2xl p-5"
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(0,229,160,0.08)" }}
              >
                <Icon size={18} style={{ color: "#00E5A0" }} />
              </div>
              <h3 className="mb-2 font-bold" style={{ color: "#DDE8F8" }}>
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(221,232,248,0.42)" }}
              >
                {description}
              </p>
            </article>
          ))}
        </div>

        <div
          className="mt-6 grid gap-3 rounded-2xl p-5 md:grid-cols-2"
          style={{
            backgroundColor: "rgba(14,30,48,0.65)",
            border: "1px solid rgba(28,49,80,0.8)",
          }}
        >
          {CONTRACTS.map(({ label, id }) => (
            <a
              key={id}
              href={mainnetContractExplorerUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.03]"
              aria-label={`${label} on Stacks Explorer`}
            >
              <span>
                <span
                  className="block text-xs font-bold uppercase tracking-wider"
                  style={{ color: "rgba(221,232,248,0.35)" }}
                >
                  {label}
                </span>
                <span
                  className="mt-1 block text-xs"
                  style={{
                    color: "#DDE8F8",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {shortenContract(id)}
                </span>
              </span>
              <ExternalLink
                size={15}
                className="shrink-0"
                style={{ color: "#00E5A0" }}
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
