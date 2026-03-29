"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Home,
  Wallet,
  ArrowLeftRight,
  Repeat2,
  Bell,
  Sparkles,
  Crown,
  Moon,
  Sun,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/themeStore";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
    },
    [router]
  );

  const commands: CommandItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Portfolio overview",
      icon: <Home size={18} />,
      action: () => navigate("/dashboard"),
      keywords: ["home", "portfolio", "overview", "dashboard"],
    },
    {
      id: "assets",
      label: "My Assets",
      description: "Holdings & P&L tracker",
      icon: <Wallet size={18} />,
      action: () => navigate("/assets"),
      keywords: ["assets", "holdings", "balance", "tokens", "pnl"],
    },
    {
      id: "swap",
      label: "Swap Tokens",
      description: "Trade on Bitflow DEX",
      icon: <ArrowLeftRight size={18} />,
      action: () => navigate("/trade"),
      keywords: ["swap", "trade", "exchange", "buy", "sell", "dex"],
    },
    {
      id: "dca",
      label: "DCA Vault",
      description: "Automated investing plans",
      icon: <Repeat2 size={18} />,
      action: () => navigate("/dca"),
      keywords: ["dca", "vault", "invest", "plan", "recurring", "auto"],
    },
    {
      id: "notifications",
      label: "Notifications",
      description: "Alerts & price targets",
      icon: <Bell size={18} />,
      action: () => navigate("/notifications"),
      keywords: ["notifications", "alerts", "price", "targets"],
    },
    {
      id: "ai",
      label: "Stacks AI",
      description: "AI-powered insights",
      icon: <Sparkles size={18} />,
      action: () => navigate("/ai"),
      keywords: ["ai", "insights", "analysis", "intelligence"],
    },
    {
      id: "premium",
      label: "Premium",
      description: "Coming soon",
      icon: <Crown size={18} />,
      action: () => navigate("/premium"),
      keywords: ["premium", "pro", "upgrade"],
    },
    {
      id: "theme",
      label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      description: "Toggle theme",
      icon: theme === "dark" ? <Sun size={18} /> : <Moon size={18} />,
      action: () => {
        toggleTheme();
        setOpen(false);
      },
      keywords: ["theme", "dark", "light", "mode", "toggle"],
    },
  ];

  const filtered = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : commands;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Trigger button in topbar */}
      <button
        onClick={() => {
          setOpen(true);
          setQuery("");
        }}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
      >
        <Search size={14} />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-medium text-gray-400 border border-gray-200 dark:border-gray-600 flex items-center gap-0.5">
          <Command size={10} />K
        </kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-lg"
            >
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-gray-800">
                  <Search size={18} className="text-gray-400 shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command or search..."
                    className="flex-1 py-4 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
                  />
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-medium text-gray-400 border border-gray-200 dark:border-gray-600">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto py-2">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">
                      No results found.
                    </div>
                  ) : (
                    filtered.map((cmd, i) => (
                      <button
                        key={cmd.id}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          i === selectedIndex
                            ? "bg-[#408A71]/10 text-[#408A71] dark:bg-[#285A48]/30 dark:text-[#B0E4CC]"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0",
                            i === selectedIndex
                              ? "text-[#408A71] dark:text-[#B0E4CC]"
                              : "text-gray-400"
                          )}
                        >
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cmd.label}</p>
                          {cmd.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {i === selectedIndex && (
                          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-medium text-gray-400 border border-gray-200 dark:border-gray-600">
                            Enter
                          </kbd>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
