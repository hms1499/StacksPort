"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  Bell,
  BarChart2,
  BarChart3,
  Sparkles,
  Crown,
  ChevronLeft,
  ChevronRight,
  Repeat2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/assets", label: "My assets", icon: Wallet },
  { href: "/trade", label: "Swap", icon: BarChart2 },
  { href: "/dca", label: "DCA Vault", icon: Repeat2 },
  { href: "/notifications", label: "Notification", icon: Bell },
  { href: "/ai", label: "Stacks AI", icon: Sparkles },
  { href: "/premium", label: "Premium", icon: Crown, soon: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
          <BarChart3 size={20} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">StacksPort</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname === href;

          if (soon) {
            return (
              <div
                key={href}
                title={collapsed ? `${label} — Coming Soon` : undefined}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 dark:text-gray-600 cursor-not-allowed select-none"
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span>{label}</span>
                    <span className="ml-auto text-[10px] font-semibold tracking-wide uppercase bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-full px-2 py-0.5">
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
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
              {!collapsed && active && (
                <ChevronRight size={14} className="ml-auto text-gray-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
      >
        {collapsed ? (
          <ChevronRight size={12} className="text-gray-500" />
        ) : (
          <ChevronLeft size={12} className="text-gray-500" />
        )}
      </button>
    </aside>
  );
}
