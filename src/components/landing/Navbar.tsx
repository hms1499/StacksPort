'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation";
import { Zap, Menu, X } from 'lucide-react';

const NAV_LINKS: ReadonlyArray<{ tKey: string; href: string; external?: boolean }> = [
  { tKey: 'features', href: '#features' },
  { tKey: 'howItWorks', href: '#how-it-works' },
  { tKey: 'github', href: 'https://github.com/hms1499/StacksPort', external: true },
];

interface NavbarProps {
  onConnectClick: () => void;
  connecting: boolean;
}

export default function Navbar({ onConnectClick, connecting }: NavbarProps) {
  const t = useTranslations('landing');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector('main');
    if (!scroller) return;
    const onScroll = () => setScrolled(scroller.scrollTop > 20);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      data-scrolled={scrolled}
      style={{
        backgroundColor: scrolled ? 'rgba(6, 12, 24, 0.90)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(28, 49, 80, 0.6)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
      }}
    >
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #00E5A0 0%, #0094FF 100%)',
              boxShadow: '0 0 16px rgba(0, 229, 160, 0.35)',
            }}
          >
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span
            className="font-bold text-base tracking-tight"
            style={{ color: '#DDE8F8', letterSpacing: '-0.03em' }}
          >
            StacksPort
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ tKey, href, external }) => (
            <a
              key={tKey}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="landing-nav-link text-sm font-medium transition-colors duration-200"
            >
              {t(`nav.${tKey}`)}
            </a>
          ))}
        </div>

        {/* CTA + Mobile trigger */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="landing-nav-link hidden text-sm font-semibold transition-colors duration-200 md:block"
          >
            {t('common.exploreDashboard')}
          </Link>
          <button
            onClick={onConnectClick}
            disabled={connecting}
            aria-busy={connecting}
            className="landing-primary-cta hidden md:flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:cursor-wait disabled:opacity-60"
          >
            {connecting ? t('common.connecting') : t('common.connectWallet')}
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={mobileOpen}
            className="md:hidden p-2 rounded-xl transition-colors"
            style={{ color: 'rgba(221, 232, 248, 0.7)' }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div
          className="md:hidden px-5 pb-5 pt-3 space-y-1"
          style={{ borderTop: '1px solid rgba(28, 49, 80, 0.6)' }}
        >
          {NAV_LINKS.map(({ tKey, href }) => (
            <a
              key={tKey}
              href={href}
              className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: 'rgba(221, 232, 248, 0.6)' }}
              onClick={() => setMobileOpen(false)}
            >
              {t(`nav.${tKey}`)}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: 'rgba(221, 232, 248, 0.6)' }}
            onClick={() => setMobileOpen(false)}
          >
            {t('common.exploreDashboard')}
          </Link>
          <button
            onClick={() => { onConnectClick(); setMobileOpen(false); }}
            disabled={connecting}
            aria-busy={connecting}
            className="landing-primary-cta w-full mt-2 py-2.5 rounded-xl text-sm font-bold disabled:cursor-wait disabled:opacity-60"
          >
            {connecting ? t('common.connecting') : t('common.connectWallet')}
          </button>
        </div>
      )}
    </nav>
  );
}
