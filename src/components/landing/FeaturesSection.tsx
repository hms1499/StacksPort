'use client';

import { useEffect, useRef } from 'react';
import {
  Repeat2, Zap, BarChart3, Bell, Shield, TrendingUp,
} from 'lucide-react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

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

export default function FeaturesSection() {
  const featuresRef = useRef<HTMLElement>(null);
  const featuresHeadingRef = useRef<HTMLDivElement>(null);
  const featureCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!featuresRef.current) return;
    const mainEl = featuresRef.current.closest('main') as HTMLElement | null;
    if (mainEl) ScrollTrigger.defaults({ scroller: mainEl });

    const ctx = gsap.context(() => {
      // ── Features heading ──
      if (featuresHeadingRef.current) {
        gsap.set(featuresHeadingRef.current, { opacity: 0, y: 20 });
        ScrollTrigger.create({
          trigger: featuresHeadingRef.current,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(featuresHeadingRef.current, {
              opacity: 1, y: 0, duration: 0.55, ease: "power3.out",
            });
          },
        });
      }

      // ── Features batch stagger ──
      const featureCards = featureCardRefs.current.filter(Boolean) as HTMLDivElement[];
      if (featureCards.length > 0) {
        gsap.set(featureCards, { opacity: 0, y: 24 });
        ScrollTrigger.batch(featureCards, {
          start: "top 85%",
          once: true,
          onEnter: (batch) => {
            gsap.to(batch, {
              opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.1,
            });
          },
        });
      }
    }, featuresRef.current);

    return () => {
      ctx.revert();
      ScrollTrigger.defaults({ scroller: window });
    };
  }, []);

  return (
    <section ref={featuresRef} id="features" className="py-24 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div ref={featuresHeadingRef} className="mb-14">
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
            <div
              key={label}
              ref={(el) => { featureCardRefs.current[i] = el; }}
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
