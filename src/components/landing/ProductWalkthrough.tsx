import {
  ArrowDown,
  BellRing,
  CheckCircle2,
  LineChart,
  Repeat2,
  ShieldCheck,
} from "lucide-react";

const STEPS = [
  {
    eyebrow: "Automate",
    title: "Build an STX to sBTC schedule",
    description:
      "Choose an amount and interval, review the full plan, and approve it from your wallet. The vault holds only the balance allocated to that plan.",
    bullets: ["Daily, weekly, or monthly", "Pause and resume anytime", "0.3% protocol fee per swap"],
    visual: "dca",
  },
  {
    eyebrow: "Measure",
    title: "Track cost basis and plan runway",
    description:
      "See portfolio value, DCA execution history, average entry price, and the number of scheduled swaps your remaining balance can support.",
    bullets: ["Live Stacks balances", "DCA vs lump-sum performance", "On-chain execution history"],
    visual: "performance",
  },
  {
    eyebrow: "Act",
    title: "Swap directly and stay informed",
    description:
      "Use Bitflow routes for direct swaps, then monitor price targets and DCA executions without watching the dashboard all day.",
    bullets: ["Real-time swap quotes", "Price and execution alerts", "Portfolio-aware AI insights"],
    visual: "alerts",
  },
] as const;

function DcaPreview() {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1626] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-bold">Create DCA plan</span>
        <span className="rounded-full bg-[#00E5A0]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#00E5A0]">
          Mainnet
        </span>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0E1E30] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Spend</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-2xl font-bold">50</span>
          <span className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-bold">STX</span>
        </div>
      </div>
      <div className="flex justify-center py-2 text-white/30">
        <ArrowDown size={15} />
      </div>
      <div className="rounded-xl border border-[#00E5A0]/20 bg-[#0E1E30] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Buy</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-white/45">Every week</span>
          <span className="rounded-lg bg-[#00E5A0]/10 px-3 py-1.5 text-sm font-bold text-[#00E5A0]">
            sBTC
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
        <ShieldCheck size={13} className="text-[#00E5A0]" />
        Confirmed from your wallet
      </div>
    </div>
  );
}

function PerformancePreview() {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1626] p-5 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">DCA performance</p>
          <p className="mt-2 font-mono text-3xl font-bold">$4,280.40</p>
          <p className="mt-1 text-xs text-[#00E5A0]">Preview portfolio · +4.8%</p>
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
          <p className="text-[10px] uppercase tracking-wider text-white/30">Average entry</p>
          <p className="mt-1 font-mono text-sm font-bold">$64,120</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Plan runway</p>
          <p className="mt-1 font-mono text-sm font-bold">8 swaps</p>
        </div>
      </div>
    </div>
  );
}

function AlertsPreview() {
  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#0A1626] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold">Swap quote</span>
          <span className="text-[10px] uppercase tracking-wider text-white/30">Via Bitflow</span>
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
            <p className="text-sm font-bold">DCA execution confirmed</p>
            <p className="mt-1 text-xs leading-relaxed text-white/40">
              Your scheduled STX to sBTC swap was confirmed on Stacks.
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
  return (
    <section id="features" aria-labelledby="product-heading" className="px-5 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-20 max-w-3xl">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#00E5A0", letterSpacing: "0.12em" }}
          >
            One workflow, end to end
          </p>
          <h2 id="product-heading" className="text-4xl font-bold md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
            From recurring buy to portfolio insight
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/45">
            StacksPort connects automation, execution, and measurement without
            taking custody of your wallet.
          </p>
        </div>

        <div className="space-y-28">
          {STEPS.map(({ eyebrow, title, description, bullets, visual }, index) => {
            const Visual = VISUALS[visual];
            return (
              <article
                key={title}
                className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
              >
                <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#00E5A0]">
                    {String(index + 1).padStart(2, "0")} · {eyebrow}
                  </p>
                  <h3 className="text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.03em" }}>
                    {title}
                  </h3>
                  <p className="mt-5 text-base leading-relaxed text-white/45">
                    {description}
                  </p>
                  <ul className="mt-7 space-y-3">
                    {bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-3 text-sm text-white/65">
                        <CheckCircle2 size={15} className="shrink-0 text-[#00E5A0]" />
                        {bullet}
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
