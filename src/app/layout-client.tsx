'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import ToastContainer from '@/components/notifications/ToastContainer';
import ThemeProvider from '@/components/ThemeProvider';
import { usePriceAlertPolling } from '@/hooks/usePriceAlertPolling';
import { AnimatePresence } from 'framer-motion';

function PriceAlertPoller() {
  usePriceAlertPolling();
  return null;
}

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <ThemeProvider>
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Sidebar — hidden on home page, desktop only */}
      {!isHomePage && (
        <div className="hidden md:block">
          <Sidebar />
        </div>
      )}

      {/* Main content — add bottom padding on mobile for BottomNav */}
      <main className={isHomePage ? 'w-full overflow-y-auto' : 'flex-1 overflow-y-auto pb-16 md:pb-0'}>
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>

      {/* Bottom nav — hidden on home page, mobile only */}
      {!isHomePage && <BottomNav />}

      {/* Toast notifications */}
      <ToastContainer />

      {/* Background services */}
      <PriceAlertPoller />
    </div>
    </ThemeProvider>
  );
}
