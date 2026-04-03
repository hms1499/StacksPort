"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Bell,
  Repeat2,
  Sparkles,
  Crown,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",     label: "Dashboard",  icon: LayoutDashboard },
  { href: "/assets",        label: "My Assets",  icon: Wallet },
  { href: "/trade",         label: "Swap",       icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA Vault",  icon: Repeat2 },
  { href: "/notifications", label: "Alerts",     icon: Bell },
  { href: "/ai",            label: "Stacks AI",  icon: Sparkles },
  { href: "/premium",       label: "Premium",    icon: Crown, soon: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        width: collapsed ? 64 : 220,
        transition: 'width 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      className="h-screen flex flex-col relative shrink-0"
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Icon mark */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, #0094FF 100%)',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <Zap size={15} className="text-white" fill="white" />
        </div>

        {!collapsed && (
          <span
            className="font-bold text-base tracking-tight truncate"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
          >
            StacksPort
          </span>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname === href;

          if (soon) {
            return (
              <div
                key={href}
                title={collapsed ? `${label} — Coming Soon` : undefined}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm select-none cursor-not-allowed"
                style={{ color: 'var(--text-muted)' }}
              >
                <Icon size={17} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="font-medium">{label}</span>
                    <span
                      className="ml-auto text-[9px] font-bold tracking-widest uppercase rounded-full px-2 py-0.5"
                      style={{
                        background: 'var(--border-subtle)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Soon
                    </span>
                  </>
                )}
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              )}
              style={
                active
                  ? {
                      backgroundColor: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      boxShadow: 'inset 0 0 0 1px var(--border-active)',
                    }
                  : {
                      color: 'var(--text-secondary)',
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-dim)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              {/* Active indicator bar */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Collapse toggle ── */}
      <div
        className="px-2 py-4"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border-subtle)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          {collapsed
            ? <PanelLeftOpen size={17} className="shrink-0" />
            : <PanelLeftClose size={17} className="shrink-0" />
          }
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
