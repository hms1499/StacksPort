'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Menu, X } from 'lucide-react';

interface NavbarProps {
  onConnectClick: () => void;
  connecting: boolean;
}

export default function Navbar({ onConnectClick, connecting }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
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
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'GitHub', href: 'https://github.com/hms1499/StacksPort', external: true },
          ].map(({ label, href, external }) => (
            <a
              key={label}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="text-sm font-medium transition-colors duration-200"
              style={{ color: 'rgba(221, 232, 248, 0.55)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#DDE8F8')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(221, 232, 248, 0.55)')}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA + Mobile trigger */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden text-sm font-semibold transition-colors duration-200 md:block"
            style={{ color: 'rgba(221, 232, 248, 0.65)' }}
          >
            Explore dashboard
          </Link>
          <button
            onClick={onConnectClick}
            disabled={connecting}
            aria-busy={connecting}
            className="hidden md:flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:cursor-wait disabled:opacity-60"
            style={{
              backgroundColor: '#00E5A0',
              color: '#060C18',
              boxShadow: '0 0 18px rgba(0, 229, 160, 0.30)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#00FFB3';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(0, 229, 160, 0.50)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#00E5A0';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(0, 229, 160, 0.30)';
            }}
          >
            {connecting ? 'Connecting...' : 'Connect wallet'}
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
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
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'GitHub', href: 'https://github.com/hms1499/StacksPort' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: 'rgba(221, 232, 248, 0.6)' }}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </a>
          ))}
          <Link
            href="/dashboard"
            className="block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: 'rgba(221, 232, 248, 0.6)' }}
            onClick={() => setMobileOpen(false)}
          >
            Explore dashboard
          </Link>
          <button
            onClick={() => { onConnectClick(); setMobileOpen(false); }}
            disabled={connecting}
            aria-busy={connecting}
            className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold disabled:cursor-wait disabled:opacity-60"
            style={{ backgroundColor: '#00E5A0', color: '#060C18' }}
          >
            {connecting ? 'Connecting...' : 'Connect wallet'}
          </button>
        </div>
      )}
    </nav>
  );
}
