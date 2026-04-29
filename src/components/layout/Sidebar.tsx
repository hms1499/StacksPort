"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Bell,
  Repeat2,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarSpring } from "@/lib/animations";

const navItems = [
  { href: "/dashboard",     label: "Dashboard",  icon: LayoutDashboard },
  { href: "/assets",        label: "My Assets",  icon: Wallet },
  { href: "/trade",         label: "Swap",       icon: ArrowLeftRight },
  { href: "/dca",           label: "DCA Vault",  icon: Repeat2 },
  { href: "/notifications", label: "Alerts",     icon: Bell },
  { href: "/ai",            label: "Stacks AI",  icon: Sparkles },
  { href: "/apps",          label: "Connected Apps", icon: Globe },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={sidebarSpring}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
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

        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="font-bold text-base tracking-tight truncate overflow-hidden"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
            >
              StacksPort
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-[background-color,color] duration-200",
                active
                  ? "text-[var(--accent)] bg-[var(--accent-dim)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]",
              )}
              style={active ? { boxShadow: 'inset 0 0 0 1px var(--border-active)' } : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={17} className="shrink-0 transition-colors duration-200" />
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
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
            "transition-[background-color,color] duration-200",
            "text-[var(--text-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-secondary)]",
          )}
        >
          {collapsed
            ? <PanelLeftOpen size={17} className="shrink-0" />
            : <PanelLeftClose size={17} className="shrink-0" />
          }
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
