"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, ArrowLeftRight, Bell, Repeat2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",     label: "Home",   icon: LayoutDashboard },
  { href: "/assets",        label: "Assets", icon: Wallet },
  { href: "/trade",         label: "Swap",   icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA",    icon: Repeat2 },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/ai",            label: "AI",     icon: Sparkles },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch md:hidden safe-bottom"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200",
            )}
            style={{
              color: active ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <div className="relative">
              <Icon size={20} />
              {active && (
                <span
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
            </div>
            <span
              className="text-[9px] font-bold tracking-wide uppercase"
              style={{ letterSpacing: '0.06em' }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
