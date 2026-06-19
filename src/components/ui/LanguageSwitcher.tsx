"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Maps a locale code to its `common` label key so new locales only need a
  // catalog entry — no edit here.
  const labelKey: Record<string, string> = {
    en: "english",
    vi: "vietnamese",
    zh: "chinese",
    ja: "japanese",
    ko: "korean",
    es: "spanish",
    pt: "portuguese",
  };

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      // pathname from @/i18n/navigation is locale-agnostic; router applies the new locale.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn("flex items-center gap-1", isPending && "opacity-60")}
      role="group"
      aria-label={t("language")}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          aria-pressed={loc === locale}
          className={cn(
            "px-2 py-1 rounded-md text-xs font-semibold uppercase transition-colors",
            loc === locale
              ? "bg-[var(--accent-dim)] text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
          )}
          title={t(labelKey[loc] ?? loc)}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
