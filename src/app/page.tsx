'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Repeat2, ArrowRight, Zap, Shield, TrendingUp,
  BarChart3, Bell, CheckCircle2, ArrowLeftRight,
} from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { connect as stacksConnect } from '@stacks/connect';
import { gsap } from '@/lib/gsap';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const FEATURES = [
  {
    icon: Repeat2,
    label: 'DCA Automation',
    desc: 'Recurring buy plans for STX→sBTC and sBTC→USDCx. Keeper bot executes on-chain — no manual action needed.',
    color: '#00E5A0',
  },
  {
    icon: Zap,
    label: 'Instant Swaps',
    desc: 'Real-time token swaps via Bitflow DEX. Best-route aggregation with minimal slippage.',
    color: '#38BDF8',
  },
  {
    icon: BarChart3,
    label: 'Portfolio Analytics',
    desc: 'Live balances, PnL tracking, Health Score, and stacking position monitoring in one view.',
    color: '#A78BFA',
  },
  {
    icon: Bell,
    label: 'Smart Alerts',
    desc: 'Price targets and plan execution notifications. Filter by type, full history included.',
    color: '#FB923C',
  },
  {
    icon: Shield,
    label: 'Non-Custodial',
    desc: 'No seed phrases shared. Your keys stay yours. Smart contracts deployed on Stacks mainnet.',
    color: '#34D399',
  },
  {
    icon: TrendingUp,
    label: 'AI Insights',
    desc: 'Market sentiment analysis, trend detection, and smart alerts powered by on-chain data.',
    color: '#F472B6',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Connect your wallet',
    desc: 'Use Leather or Xverse. No seed phrases shared — your keys never leave your device.',
  },
  {
    n: '02',
    title: 'Create a DCA plan',
    desc: 'Pick a token pair, set your amount and interval. Deposit STX or sBTC as collateral.',
  },
  {
    n: '03',
    title: 'Let the bot execute',
    desc: 'Our keeper bot runs via GitHub Actions and executes your plan on-chain at every interval. Pause or cancel anytime.',
  },
];

export default function Home() {
  const router = useRouter();
  const { isConnected, connect } = useWalletStore();
  const [connecting, setConnecting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const dotGridRef = useRef<HTMLDivElement>(null);
  const ambientGlowRef = useRef<HTMLDivElement>(null);
  const floatingCardsRef = useRef<HTMLDivElement>(null);
  const heroBadgeRef = useRef<HTMLDivElement>(null);
  const heroH1Ref = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroButtonsRef = useRef<HTMLDivElement>(null);
  const heroTrustRef = useRef<HTMLDivElement>(null);
  const portfolioCardRef = useRef<HTMLDivElement>(null);
  const dcaCardRef = useRef<HTMLDivElement>(null);
  const execBadgeRef = useRef<HTMLDivElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const svgFillRef = useRef<SVGPathElement>(null);

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await stacksConnect();
      const stxEntry = result.addresses.find(
        (a) => a.symbol === 'STX' || a.address.startsWith('SP') || a.address.startsWith('ST')
      );
      const btcEntry = result.addresses.find(
        (a) => a.symbol === 'BTC' || (!a.address.startsWith('SP') && !a.address.startsWith('ST'))
      );
      connect(stxEntry?.address ?? result.addresses[0]?.address ?? '', btcEntry?.address ?? '');
    } catch {
      // user cancelled
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (isConnected) router.push('/dashboard');
  }, [isConnected, router]);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // ── Hero entry timeline ──
      const heroEntryEls = [
        heroBadgeRef.current,
        heroH1Ref.current,
        heroSubRef.current,
        heroButtonsRef.current,
        heroTrustRef.current,
      ];

      gsap.set(heroEntryEls, { opacity: 0, y: 28 });

      const tl = gsap.timeline({ delay: 0.1 });
      heroEntryEls.forEach((el, i) => {
        if (!el) return;
        tl.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
        }, i * 0.1);
      });

      // ── SVG chart draw-on (after entry completes) ──
      if (svgPathRef.current) {
        const path = svgPathRef.current;
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        tl.to(path, {
          strokeDashoffset: 0,
          duration: 1.2,
          ease: "power2.inOut",
        }, 0.5);
      }
      if (svgFillRef.current) {
        gsap.set(svgFillRef.current, { opacity: 0 });
        tl.to(svgFillRef.current, {
          opacity: 1,
          duration: 0.8,
          ease: "power2.out",
        }, 1.0);
      }

      // ── Floating cards ──
      if (portfolioCardRef.current) {
        gsap.to(portfolioCardRef.current, {
          y: -10, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut",
        });
      }
      if (dcaCardRef.current) {
        gsap.to(dcaCardRef.current, {
          y: -7, duration: 5.5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.8,
        });
      }
      if (execBadgeRef.current) {
        gsap.to(execBadgeRef.current, {
          opacity: 0.6, duration: 3, repeat: -1, yoyo: true, ease: "sine.inOut",
        });
      }

      // ── Hero parallax on scroll ──
      if (heroRef.current) {
        const parallaxTrigger = {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        };

        if (dotGridRef.current) {
          gsap.to(dotGridRef.current, {
            y: -50,
            scrollTrigger: parallaxTrigger,
          });
        }
        if (ambientGlowRef.current) {
          gsap.to(ambientGlowRef.current, {
            y: -30,
            scrollTrigger: parallaxTrigger,
          });
        }
        if (floatingCardsRef.current) {
          gsap.to(floatingCardsRef.current, {
            y: 40,
            scrollTrigger: parallaxTrigger,
          });
        }
      }
    }, containerRef.current);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#060C18', color: '#DDE8F8' }}
    >
      <Navbar onConnectClick={handleConnect} />

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden px-5 md:px-8 pt-16">
        {/* Ambient glow background */}
        <div
          ref={ambientGlowRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,229,160,0.08) 0%, transparent 65%),
              radial-gradient(ellipse 50% 40% at 85% 80%, rgba(0,140,229,0.05) 0%, transparent 60%)
            `,
          }}
        />
        {/* Dot grid */}
        <div
          ref={dotGridRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(28,49,80,0.5) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-24 md:py-32">

          {/* ── Left: copy ── */}
          <div>
            <div ref={heroBadgeRef}>
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8"
                style={{
                  backgroundColor: 'rgba(0,229,160,0.08)',
                  color: '#00E5A0',
                  border: '1px solid rgba(0,229,160,0.25)',
                  letterSpacing: '0.1em',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#00E5A0', boxShadow: '0 0 6px #00E5A0', animation: 'pulse 2s infinite' }}
                />
                Live on Stacks Mainnet
              </span>
            </div>

            <h1
              ref={heroH1Ref}
              className="text-5xl md:text-6xl lg:text-7xl font-bold leading-none mb-6"
              style={{ letterSpacing: '-0.04em' }}
            >
              Smart Portfolio<br />
              <span
                style={{
                  backgroundImage: 'linear-gradient(135deg, #00E5A0 0%, #38BDF8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                for Stacks
              </span>
            </h1>

            <p
              ref={heroSubRef}
              className="text-lg leading-relaxed mb-10 max-w-lg"
              style={{ color: 'rgba(221,232,248,0.55)' }}
            >
              Automate DCA plans, execute instant swaps, and track your portfolio
              — all non-custodial, all on-chain.
            </p>

            <div
              ref={heroButtonsRef}
              className="flex flex-col sm:flex-row gap-3 mb-10"
            >
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: '#00E5A0',
                  color: '#060C18',
                  boxShadow: '0 0 28px rgba(0,229,160,0.35)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(0,229,160,0.55)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#00FFB3';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(0,229,160,0.35)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#00E5A0';
                }}
              >
                {connecting ? 'Connecting…' : 'Launch App'}
                <ArrowRight size={16} />
              </button>
              <a
                href="#features"
                className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ border: '1px solid rgba(28,49,80,1)', color: 'rgba(221,232,248,0.5)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,160,0.3)';
                  (e.currentTarget as HTMLElement).style.color = '#DDE8F8';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,49,80,1)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(221,232,248,0.5)';
                }}
              >
                See Features
              </a>
            </div>

            <div
              ref={heroTrustRef}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
              style={{ color: 'rgba(221,232,248,0.3)' }}
            >
              {['Non-custodial', 'Audited contracts', 'Stacks mainnet'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} style={{ color: '#00E5A0' }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: floating preview UI ── */}
          <div ref={floatingCardsRef} className="relative h-[440px] hidden lg:block">
            {/* Portfolio balance card */}
            <div
              ref={portfolioCardRef}
              className="absolute top-4 left-0 right-16 rounded-2xl p-5"
              style={{
                backgroundColor: '#0E1E30',
                border: '1px solid rgba(28,49,80,0.8)',
                boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
              }}
            >
              <p
                className="text-xs font-bold tracking-widest uppercase mb-3"
                style={{ color: 'rgba(221,232,248,0.25)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}
              >
                Portfolio Value
              </p>
              <div className="flex items-baseline gap-3 mb-1">
                <p
                  className="text-3xl font-bold"
                  style={{ color: '#DDE8F8', letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}
                >
                  $12,847.50
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ color: '#00E5A0', backgroundColor: 'rgba(0,229,160,0.1)', fontFamily: 'var(--font-mono)' }}
                >
                  +4.2%
                </span>
              </div>
              {/* SVG mini chart */}
              <svg className="w-full mt-3" height="44" viewBox="0 0 260 44" fill="none">
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5A0" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#00E5A0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  ref={svgPathRef}
                  d="M0,38 C30,34 55,28 80,24 C105,20 130,16 160,12 C185,9 210,7 240,4 L260,3"
                  stroke="#00E5A0" strokeWidth="1.5"
                />
                <path
                  ref={svgFillRef}
                  d="M0,38 C30,34 55,28 80,24 C105,20 130,16 160,12 C185,9 210,7 240,4 L260,3 L260,44 L0,44Z"
                  fill="url(#hg)"
                />
              </svg>
            </div>

            {/* DCA plan card */}
            <div
              ref={dcaCardRef}
              className="absolute bottom-8 right-0 left-20 rounded-2xl p-5"
              style={{
                backgroundColor: '#142538',
                border: '1px solid rgba(0,229,160,0.2)',
                boxShadow: '0 24px 48px rgba(0,229,160,0.06), 0 0 0 1px rgba(0,229,160,0.08)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(221,232,248,0.25)', letterSpacing: '0.1em' }}
                >
                  DCA Plan
                </p>
                <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#00E5A0', fontFamily: 'var(--font-mono)' }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#00E5A0', animation: 'pulse 2s infinite' }}
                  />
                  Running
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight size={13} style={{ color: 'rgba(221,232,248,0.4)' }} />
                <p className="font-bold text-sm" style={{ color: '#DDE8F8' }}>STX → sBTC</p>
              </div>
              <p
                className="text-xs mb-3"
                style={{ color: 'rgba(221,232,248,0.35)', fontFamily: 'var(--font-mono)' }}
              >
                50 STX · every 144 blocks
              </p>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(28,49,80,0.8)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: '68%', backgroundColor: '#00E5A0', boxShadow: '0 0 6px #00E5A0' }}
                  />
                </div>
                <span className="text-xs font-bold" style={{ color: '#00E5A0', fontFamily: 'var(--font-mono)' }}>
                  68%
                </span>
              </div>
            </div>

            {/* Executions badge */}
            <div
              ref={execBadgeRef}
              className="absolute top-1/2 -translate-y-1/2 right-0 rounded-2xl px-4 py-3 text-center"
              style={{
                backgroundColor: '#0E1E30',
                border: '1px solid rgba(28,49,80,0.8)',
              }}
            >
              <p
                className="text-2xl font-bold"
                style={{ color: '#DDE8F8', letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}
              >
                1,247
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(221,232,248,0.3)' }}>Executions</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS STRIP
      ══════════════════════════════════════ */}
      <section style={{ borderTop: '1px solid rgba(28,49,80,0.6)', borderBottom: '1px solid rgba(28,49,80,0.6)' }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'DCA Plans Created', value: '847+' },
            { label: 'Volume Executed',   value: '$2.1M' },
            { label: 'Active Users',      value: '1,200+' },
            { label: 'Avg Return',        value: '+18.4%' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p
                className="text-3xl md:text-4xl font-bold mb-1"
                style={{ color: '#00E5A0', letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}
              >
                {value}
              </p>
              <p
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: 'rgba(221,232,248,0.25)', letterSpacing: '0.08em' }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <section id="features" className="py-24 px-5 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: '#00E5A0', letterSpacing: '0.12em' }}
            >
              Features
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold"
              style={{ letterSpacing: '-0.03em' }}
            >
              Everything you need<br />
              <span style={{ color: 'rgba(221,232,248,0.35)' }}>to grow on Stacks</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, label, desc, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl p-6 group"
                style={{
                  backgroundColor: '#0E1E30',
                  border: '1px solid rgba(28,49,80,0.8)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${color}10`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,49,80,0.8)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon size={19} style={{ color }} />
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: '#DDE8F8' }}>{label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(221,232,248,0.40)' }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="py-24 px-5 md:px-8"
        style={{ borderTop: '1px solid rgba(28,49,80,0.6)' }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: '#00E5A0', letterSpacing: '0.12em' }}
            >
              How it works
            </p>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ letterSpacing: '-0.03em' }}>
              Three steps to automate
            </h2>
          </div>

          <div className="space-y-3">
            {STEPS.map(({ n, title, desc }, i) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-6 rounded-2xl p-6"
                style={{ backgroundColor: '#0E1E30', border: '1px solid rgba(28,49,80,0.8)' }}
              >
                <span
                  className="text-4xl font-bold shrink-0 leading-none pt-0.5"
                  style={{ color: 'rgba(28,49,80,1)', letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}
                >
                  {n}
                </span>
                <div>
                  <h3 className="font-bold text-lg mb-1.5" style={{ color: '#DDE8F8' }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(221,232,248,0.40)' }}>{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA
      ══════════════════════════════════════ */}
      <section
        className="py-28 px-5 md:px-8 relative overflow-hidden"
        style={{ borderTop: '1px solid rgba(28,49,80,0.6)' }}
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,229,160,0.07) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" style={{ letterSpacing: '-0.04em' }}>
              Start investing{' '}
              <span
                style={{
                  backgroundImage: 'linear-gradient(135deg, #00E5A0 0%, #38BDF8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                on autopilot
              </span>
            </h2>
            <p className="text-lg mb-10" style={{ color: 'rgba(221,232,248,0.45)' }}>
              Connect once, automate forever. Your first DCA plan takes less than two minutes.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl text-base font-bold transition-all duration-300 disabled:opacity-50"
              style={{
                backgroundColor: '#00E5A0',
                color: '#060C18',
                boxShadow: '0 0 40px rgba(0,229,160,0.35)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#00FFB3';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(0,229,160,0.55)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#00E5A0';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(0,229,160,0.35)';
              }}
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
