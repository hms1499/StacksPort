"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Bell,
  Repeat2,
  Sparkles,
  Globe,
  Circle,
  MoreHorizontal,
  Sprout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

const primaryNavItems = [
  { href: "/dashboard",     key: "home",        icon: LayoutDashboard },
  { href: "/assets",        key: "assetsShort", icon: Wallet },
  { href: "/trade",         key: "swap",        icon: ArrowLeftRight },
  { href: "/dca",           key: "dcaShort",    icon: Repeat2 },
] as const;

const moreNavItems = [
  { href: "/earn",          key: "earn",      icon: Sprout },
  { href: "/bubbles",       key: "bubbles",   icon: Circle },
  { href: "/notifications", key: "alerts",    icon: Bell },
  { href: "/ai",            key: "aiShort",   icon: Sparkles },
  { href: "/apps",          key: "appsShort", icon: Globe },
] as const;

export default function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreNavItems.some((item) => pathname === item.href);

  const itemClass = cn(
    "flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200",
  );

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close more menu"
              className="fixed inset-0 z-30 md:hidden bg-black/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              data-testid="bottom-nav-more-menu"
              aria-label="More navigation"
              className="fixed left-3 right-3 bottom-20 z-50 md:hidden rounded-2xl p-2 shadow-xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {moreNavItems.map(({ href, key, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      backgroundColor: active ? 'var(--accent-dim)' : 'transparent',
                    }}
                  >
                    <Icon size={18} />
                    <span>{t(key)}</span>
                  </Link>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch md:hidden safe-bottom"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {primaryNavItems.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={itemClass}
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
              onClick={() => setMoreOpen(false)}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <motion.span
                    layoutId="bottomnav-active"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[10px] font-semibold tracking-wide">
                {t(key)}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          className={itemClass}
          style={{
            color: moreActive || moreOpen ? 'var(--accent)' : 'var(--text-muted)',
          }}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <div className="relative">
            <MoreHorizontal size={20} strokeWidth={moreActive || moreOpen ? 2.5 : 2} />
            {(moreActive || moreOpen) && (
              <motion.span
                layoutId="bottomnav-active"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-wide">{t("more")}</span>
        </button>
      </nav>
    </>
  );
}
