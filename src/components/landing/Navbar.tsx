'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, BarChart3 } from 'lucide-react';

interface NavbarProps {
  onConnectClick: () => void;
}

export default function Navbar({ onConnectClick }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#408A71] to-[#285A48] flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">StacksPort</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              How It Works
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* CTA + Mobile Menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={onConnectClick}
              className="hidden md:inline-flex px-6 py-2 bg-[#408A71] hover:bg-[#285A48] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Connect Wallet
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="md:hidden pt-4 pb-2 border-t border-gray-100 mt-4 space-y-2">
            <Link
              href="#features"
              className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              onClick={() => setMobileOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              onClick={() => setMobileOpen(false)}
            >
              How It Works
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              GitHub
            </a>
            <button
              onClick={() => {
                onConnectClick();
                setMobileOpen(false);
              }}
              className="w-full mt-2 px-4 py-2 bg-[#408A71] hover:bg-[#285A48] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
