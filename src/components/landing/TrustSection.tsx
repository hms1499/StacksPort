import { useTranslations } from "next-intl";
import { Bot, ExternalLink, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import {
  DCA_CONTRACT_ID,
  DCA_SBTC_CONTRACT_ID,
  mainnetContractExplorerUrl,
} from "@/lib/dca-contracts";

const TRUST_POINTS = [
  { icon: KeyRound, key: "control" },
  { icon: Bot, key: "automated" },
  { icon: RotateCcw, key: "pause" },
  { icon: ShieldCheck, key: "fees" },
] as const;

const CONTRACTS = [
  { key: "stxSbtc", id: DCA_CONTRACT_ID },
  { key: "sbtcUsdcx", id: DCA_SBTC_CONTRACT_ID },
] as const;

function shortenContract(contractId: string): string {
  const [address, name] = contractId.split(".");
  return `${address.slice(0, 6)}...${address.slice(-4)}.${name}`;
}

export default function TrustSection() {
  const t = useTranslations("landing.trust");
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
            {t("eyebrow")}
          </p>
          <h2
            id="trust-heading"
            className="text-4xl font-bold md:text-5xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            {t("heading")}
          </h2>
          <p
            className="mt-5 text-base leading-relaxed"
            style={{ color: "rgba(221,232,248,0.5)" }}
          >
            {t("intro")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map(({ icon: Icon, key }) => (
            <article
              key={key}
              className="landing-card rounded-2xl p-5"
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(0,229,160,0.08)" }}
              >
                <Icon size={18} style={{ color: "#00E5A0" }} />
              </div>
              <h3 className="mb-2 font-bold" style={{ color: "#DDE8F8" }}>
                {t(`points.${key}.title`)}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(221,232,248,0.42)" }}
              >
                {t(`points.${key}.desc`)}
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
          {CONTRACTS.map(({ key, id }) => (
            <a
              key={id}
              href={mainnetContractExplorerUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.03]"
              aria-label={t("explorerAria", { label: t(`contracts.${key}`) })}
            >
              <span>
                <span
                  className="block text-xs font-bold uppercase tracking-wider"
                  style={{ color: "rgba(221,232,248,0.35)" }}
                >
                  {t(`contracts.${key}`)}
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
