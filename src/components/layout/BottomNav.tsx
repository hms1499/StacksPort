"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, ArrowLeftRight, Bell, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/assets", label: "Assets", icon: Wallet },
  { href: "/trade", label: "Swap", icon: ArrowLeftRight },
  { href: "/notifications", label: "Alerts", icon: Bell, soon: true },
  { href: "/ai", label: "AI", icon: Sparkles, soon: true },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 flex items-stretch md:hidden safe-bottom">
      {navItems.map(({ href, label, icon: Icon, soon }) => {
        const active = pathname === href;

        if (soon) {
          return (
            <div
              key={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-300 select-none"
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
              <span className="text-[8px] uppercase tracking-wide text-gray-300 leading-none">soon</span>
            </div>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              active ? "text-teal-500" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
