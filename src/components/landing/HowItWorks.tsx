'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { gsap, ScrollTrigger } from '@/lib/gsap';

const STEPS = [
  { n: '01', key: 's1' },
  { n: '02', key: 's2' },
  { n: '03', key: 's3' },
] as const;

export default function HowItWorks() {
  const t = useTranslations('landing.how');
  const howRef = useRef<HTMLElement>(null);
  const howHeadingRef = useRef<HTMLDivElement>(null);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!howRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
            {t('eyebrow')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold" style={{ letterSpacing: '-0.03em' }}>
            {t('heading')}
          </h2>
        </div>

        <div className="space-y-3">
          {STEPS.map(({ n, key }, i) => (
            <div
              key={n}
              ref={(el) => { stepCardRefs.current[i] = el; }}
              className="landing-card flex gap-6 rounded-2xl p-6"
            >
              <span
                className="text-4xl font-bold shrink-0 leading-none pt-0.5"
                style={{ color: 'rgba(28,49,80,1)', letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}
              >
                {n}
              </span>
              <div>
                <h3 className="font-bold text-lg mb-1.5" style={{ color: '#DDE8F8' }}>{t(`steps.${key}.title`)}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(221,232,248,0.40)' }}>{t(`steps.${key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
