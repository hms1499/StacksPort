'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

export default function CTASection({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting: boolean;
}) {
  const ctaRef = useRef<HTMLElement>(null);
  const ctaGlowRef = useRef<HTMLDivElement>(null);
  const ctaH2Ref = useRef<HTMLHeadingElement>(null);
  const ctaSubRef = useRef<HTMLParagraphElement>(null);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ctaRef.current) return;
    const mainEl = ctaRef.current.closest('main') as HTMLElement | null;
    if (mainEl) ScrollTrigger.defaults({ scroller: mainEl });

    const ctx = gsap.context(() => {
      // ── CTA parallax glow ──
      if (ctaGlowRef.current && ctaRef.current) {
        gsap.to(ctaGlowRef.current, {
          y: -20,
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // ── CTA content stagger ──
      const ctaEls = [ctaH2Ref.current, ctaSubRef.current, ctaBtnRef.current];
      if (ctaEls[0]) {
        gsap.set(ctaEls, { opacity: 0, y: 20 });
        ScrollTrigger.create({
          trigger: ctaRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            gsap.to(ctaEls, {
              opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1,
            });
          },
        });
      }
    }, ctaRef.current);

    return () => {
      ctx.revert();
      ScrollTrigger.defaults({ scroller: window });
    };
  }, []);

  return (
    <section
      ref={ctaRef}
      className="py-28 px-5 md:px-8 relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(28,49,80,0.6)' }}
    >
      {/* Radial glow */}
      <div
        ref={ctaGlowRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,229,160,0.07) 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-2xl mx-auto text-center">
        <h2
          ref={ctaH2Ref}
          className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
          style={{ letterSpacing: '-0.04em' }}
        >
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
        <p
          ref={ctaSubRef}
          className="text-lg mb-10"
          style={{ color: 'rgba(221,232,248,0.45)' }}
        >
          Connect once, automate forever. Your first DCA plan takes less than two minutes.
        </p>
        <button
          ref={ctaBtnRef}
          onClick={onConnect}
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
          {connecting ? 'Connecting...' : 'Connect Wallet'}
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
