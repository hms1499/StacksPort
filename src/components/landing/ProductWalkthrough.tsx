import { useTranslations } from "next-intl";
import {
  ArrowDown,
  BellRing,
  CheckCircle2,
  LineChart,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

const STEPS = [
  { key: "automate", visual: "dca" },
  { key: "measure", visual: "performance" },
  { key: "act", visual: "alerts" },
] as const;

function DcaPreview() {
  const t = useTranslations("landing.walkthrough.dcaPreview");
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1626] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-bold">{t("title")}</span>
        <span className="rounded-full bg-[#00E5A0]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#00E5A0]">
          {t("mainnet")}
        </span>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0E1E30] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t("spend")}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-2xl font-bold">50</span>
          <span className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-bold">STX</span>
        </div>
      </div>
      <div className="flex justify-center py-2 text-white/30">
        <ArrowDown size={15} />
      </div>
      <div className="rounded-xl border border-[#00E5A0]/20 bg-[#0E1E30] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t("buy")}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-white/45">{t("everyWeek")}</span>
          <span className="rounded-lg bg-[#00E5A0]/10 px-3 py-1.5 text-sm font-bold text-[#00E5A0]">
            sBTC
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
        <ShieldCheck size={13} className="text-[#00E5A0]" />
        {t("confirmed")}
      </div>
    </div>
  );
}

function PerformancePreview() {
  const t = useTranslations("landing.walkthrough.perfPreview");
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1626] p-5 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t("label")}</p>
          <p className="mt-2 font-mono text-3xl font-bold">$4,280.40</p>
          <p className="mt-1 text-xs text-[#00E5A0]">{t("preview")}</p>
        </div>
        <div className="rounded-xl bg-[#38BDF8]/10 p-2.5 text-[#38BDF8]">
          <LineChart size={18} />
        </div>
      </div>
      <svg className="mt-6 h-28 w-full" viewBox="0 0 360 112" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="walkthrough-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#00E5A0" stopOpacity=".24" />
            <stop offset="1" stopColor="#00E5A0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 95 C35 90 56 72 88 78 C121 84 142 50 177 56 C210 61 236 31 270 38 C305 44 330 18 360 20 L360 112 L0 112Z"
          fill="url(#walkthrough-chart-fill)"
        />
        <path
          d="M0 95 C35 90 56 72 88 78 C121 84 142 50 177 56 C210 61 236 31 270 38 C305 44 330 18 360 20"
          stroke="#00E5A0"
          strokeWidth="2"
        />
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30">{t("avgEntry")}</p>
          <p className="mt-1 font-mono text-sm font-bold">$64,120</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30">{t("runway")}</p>
          <p className="mt-1 font-mono text-sm font-bold">{t("swaps")}</p>
        </div>
      </div>
    </div>
  );
}

function AlertsPreview() {
  const t = useTranslations("landing.walkthrough.alertsPreview");
  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#0A1626] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold">{t("quote")}</span>
          <span className="text-[10px] uppercase tracking-wider text-white/30">{t("viaBitflow")}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-4">
          <span className="font-mono text-lg font-bold">100 STX</span>
          <Repeat2 size={15} className="text-white/30" />
          <span className="font-mono text-lg font-bold text-[#00E5A0]">sBTC</span>
        </div>
      </div>
      <div className="ml-6 rounded-2xl border border-[#38BDF8]/20 bg-[#102238] p-4 shadow-xl">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#38BDF8]/10 text-[#38BDF8]">
            <BellRing size={16} />
          </div>
          <div>
            <p className="text-sm font-bold">{t("execConfirmed")}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              {t("execDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const VISUALS = {
  dca: DcaPreview,
  performance: PerformancePreview,
  alerts: AlertsPreview,
} as const;

export default function ProductWalkthrough() {
  const t = useTranslations("landing.walkthrough");
  return (
    <section id="features" aria-labelledby="product-heading" className="px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-20 max-w-3xl">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#00E5A0", letterSpacing: "0.12em" }}
          >
            {t("eyebrow")}
          </p>
          <h2 id="product-heading" className="text-4xl font-bold md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
            {t("heading")}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/45">
            {t("intro")}
          </p>
        </div>

        <div className="space-y-28">
          {STEPS.map(({ key, visual }, index) => {
            const Visual = VISUALS[visual];
            return (
              <article
                key={key}
                className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
              >
                <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#00E5A0]">
                    {String(index + 1).padStart(2, "0")} · {t(`steps.${key}.eyebrow`)}
                  </p>
                  <h3 className="text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.03em" }}>
                    {t(`steps.${key}.title`)}
                  </h3>
                  <p className="mt-5 text-base leading-relaxed text-white/45">
                    {t(`steps.${key}.description`)}
                  </p>
                  <ul className="mt-7 space-y-3">
                    {["b1", "b2", "b3"].map((b) => (
                      <li key={b} className="flex items-center gap-3 text-sm text-white/65">
                        <CheckCircle2 size={15} className="shrink-0 text-[#00E5A0]" />
                        {t(`steps.${key}.${b}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : undefined}>
                  <Visual />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
