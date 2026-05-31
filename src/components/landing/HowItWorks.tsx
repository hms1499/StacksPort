'use client';

import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

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

export default function HowItWorks() {
  const howRef = useRef<HTMLElement>(null);
  const howHeadingRef = useRef<HTMLDivElement>(null);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!howRef.current) return;
    const mainEl = howRef.current.closest('main') as HTMLElement | null;
    if (mainEl) ScrollTrigger.defaults({ scroller: mainEl });

    const ctx = gsap.context(() => {
      if (howHeadingRef.current) {
        gsap.set(howHeadingRef.current, { opacity: 0, y: 16 });
        ScrollTrigger.create({
          trigger: howHeadingRef.current,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(howHeadingRef.current, {
              opacity: 1, y: 0, duration: 0.55, ease: "power3.out",
            });
          },
        });
      }

      const stepCards = stepCardRefs.current.filter(Boolean) as HTMLDivElement[];
      if (stepCards.length > 0) {
        gsap.set(stepCards, { opacity: 0, x: -24 });
        ScrollTrigger.create({
          trigger: howRef.current,
          start: "top 75%",
          once: true,
          onEnter: () => {
            gsap.to(stepCards, {
              opacity: 1, x: 0, duration: 0.55, ease: "power3.out", stagger: 0.15,
            });
          },
        });
      }
    }, howRef.current);

    return () => {
      ctx.revert();
      ScrollTrigger.defaults({ scroller: window });
    };
  }, []);

  return (
    <section
      ref={howRef}
      id="how-it-works"
      className="py-24 px-5 md:px-8"
      style={{ borderTop: '1px solid rgba(28,49,80,0.6)' }}
    >
      <div className="max-w-3xl mx-auto">
        <div ref={howHeadingRef} className="text-center mb-14">
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
            <div
              key={n}
              ref={(el) => { stepCardRefs.current[i] = el; }}
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
