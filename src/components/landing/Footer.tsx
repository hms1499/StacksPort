'use client';

import Link from 'next/link';
import { Zap, XIcon } from 'lucide-react';

function GitHubSVG({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: '#030810', borderTop: '1px solid rgba(28, 49, 80, 0.6)' }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00E5A0 0%, #0094FF 100%)' }}
              >
                <Zap size={13} className="text-white" fill="white" />
              </div>
              <span className="font-bold text-base" style={{ color: '#DDE8F8', letterSpacing: '-0.03em' }}>
                StacksPort
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(221, 232, 248, 0.35)' }}>
              Non-custodial DCA automation and portfolio management on Stacks blockchain.
            </p>
            <div className="flex items-center gap-2">
              {[
                { href: 'https://github.com', icon: GitHubSVG, label: 'GitHub' },
                { href: 'https://twitter.com', icon: XIcon, label: 'Twitter' },
              ].map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'rgba(221, 232, 248, 0.35)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#00E5A0';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 229, 160, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(221, 232, 248, 0.35)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '';
                  }}
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-12 md:gap-16">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: 'rgba(221, 232, 248, 0.25)', letterSpacing: '0.1em' }}>
                Product
              </p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Features', href: '#features' },
                  { label: 'How it works', href: '#how-it-works' },
                  { label: 'GitHub', href: 'https://github.com' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm transition-colors"
                      style={{ color: 'rgba(221, 232, 248, 0.45)' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#00E5A0')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(221, 232, 248, 0.45)')}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: 'rgba(221, 232, 248, 0.25)', letterSpacing: '0.1em' }}>
                Legal
              </p>
              <ul className="space-y-2.5">
                {[
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Terms', href: '/terms' },
                  { label: 'Security', href: '/security' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm transition-colors"
                      style={{ color: 'rgba(221, 232, 248, 0.45)' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#00E5A0')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(221, 232, 248, 0.45)')}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-3 mt-12 pt-8"
          style={{ borderTop: '1px solid rgba(28, 49, 80, 0.4)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(221, 232, 248, 0.2)', fontFamily: 'var(--font-mono)' }}>
            © {year} StacksPort — Built on Stacks
          </p>
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#00E5A0', boxShadow: '0 0 6px #00E5A0' }}
            />
            <span className="text-xs" style={{ color: 'rgba(221, 232, 248, 0.3)', fontFamily: 'var(--font-mono)' }}>
              Mainnet
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
