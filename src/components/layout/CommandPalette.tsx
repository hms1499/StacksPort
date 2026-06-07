"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Home,
  Wallet,
  ArrowLeftRight,
  Repeat2,
  Bell,
  Sparkles,
  Moon,
  Sun,
  Command,
  Clock,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

const RECENTS_KEY = "stacksport_cmdk_recents";
const RECENTS_MAX = 3;

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

export default function CommandPalette() {
  const t = useTranslations("common.cmdk");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();

  function pushRecent(id: string) {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENTS_MAX);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const navigate = useCallback(
    (path: string, id: string) => {
      pushRecent(id);
      router.push(path);
      setOpen(false);
    },
    [router]
  );

  const commands: CommandItem[] = [
    { id: "dashboard",     label: t("home.label"),          description: t("home.desc"),          icon: <Home size={18} />,         action: () => navigate("/dashboard", "dashboard"),      keywords: ["home", "portfolio", "overview", "dashboard"] },
    { id: "assets",        label: t("assets.label"),        description: t("assets.desc"),        icon: <Wallet size={18} />,       action: () => navigate("/assets", "assets"),            keywords: ["assets", "holdings", "balance", "tokens", "pnl"] },
    { id: "swap",          label: t("swap.label"),          description: t("swap.desc"),          icon: <ArrowLeftRight size={18} />, action: () => navigate("/trade", "swap"),             keywords: ["swap", "trade", "exchange", "buy", "sell", "dex"] },
    { id: "dca",           label: t("dca.label"),           description: t("dca.desc"),           icon: <Repeat2 size={18} />,      action: () => navigate("/dca", "dca"),                  keywords: ["dca", "vault", "invest", "plan", "recurring", "auto"] },
    { id: "notifications", label: t("notifications.label"), description: t("notifications.desc"), icon: <Bell size={18} />,         action: () => navigate("/notifications", "notifications"), keywords: ["notifications", "alerts", "price", "targets"] },
    { id: "ai",            label: t("ai.label"),            description: t("ai.desc"),            icon: <Sparkles size={18} />,     action: () => navigate("/ai", "ai"),                    keywords: ["ai", "insights", "analysis", "intelligence"] },
    {
      id: "theme",
      label: theme === "dark" ? t("themeLight") : t("themeDark"),
      description: t("themeDesc"),
      icon: theme === "dark" ? <Sun size={18} /> : <Moon size={18} />,
      action: () => { pushRecent("theme"); toggleTheme(); setOpen(false); },
      keywords: ["theme", "dark", "light", "mode", "toggle"],
    },
  ];

  // When no query, surface recent commands at the top followed by the rest.
  // When typing, plain filter so search matches feel deterministic.
  const recentCmds = recents
    .map((id) => commands.find((c) => c.id === id))
    .filter((c): c is CommandItem => Boolean(c));
  const recentIds = new Set(recentCmds.map((c) => c.id));
  const restCmds = commands.filter((c) => !recentIds.has(c.id));

  const filtered = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : [...recentCmds, ...restCmds];
  const recentDivider = !query && recentCmds.length > 0 ? recentCmds.length : 0;

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
      setRecents(readRecents());
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

  const kbdStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-subtle)',
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); setQuery(""); }}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors"
        style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
      >
        <Search size={14} />
        <span>{t("searchPlaceholder")}</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-0.5" style={kbdStyle}>
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
              <div className="glass-card no-hover-lift rounded-2xl shadow-2xl overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <Search size={18} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("inputPlaceholder")}
                    className="flex-1 py-4 bg-transparent text-sm outline-none placeholder:text-gray-400"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={kbdStyle}>
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto py-2">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t("noResults")}
                    </div>
                  ) : (
                    <>
                      {recentDivider > 0 && (
                        <div
                          className="px-4 pt-1 pb-1.5 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5"
                          style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
                        >
                          <Clock size={10} /> {t("recent")}
                        </div>
                      )}
                      {filtered.map((cmd, i) => {
                        const isSelected = i === selectedIndex;
                        const showAllHeader = recentDivider > 0 && i === recentDivider;
                        return (
                          <div key={cmd.id}>
                            {showAllHeader && (
                              <div
                                className="px-4 pt-2 pb-1.5 text-[10px] font-bold tracking-widest uppercase"
                                style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
                              >
                                {t("allCommands")}
                              </div>
                            )}
                            <button
                              onClick={cmd.action}
                              onMouseEnter={() => setSelectedIndex(i)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                              style={isSelected
                                ? { backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }
                                : { color: 'var(--text-secondary)' }
                              }
                            >
                              <span className="shrink-0" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {cmd.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{cmd.label}</p>
                                {cmd.description && (
                                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {cmd.description}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={kbdStyle}>
                                  {t("enter")}
                                </kbd>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Keyboard hints footer */}
                <div
                  className="flex items-center justify-between px-4 py-2 text-[10px]"
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded" style={kbdStyle}><ArrowUp size={9} /></kbd>
                      <kbd className="px-1 py-0.5 rounded" style={kbdStyle}><ArrowDown size={9} /></kbd>
                      {t("navigate")}
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded" style={kbdStyle}><CornerDownLeft size={9} /></kbd>
                      {t("select")}
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded" style={kbdStyle}>esc</kbd>
                    {t("close")}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
