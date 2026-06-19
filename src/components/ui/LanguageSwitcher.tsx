"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import Flag from "@/components/ui/Flag";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Maps a locale code to its `common` label key so a new locale only needs a
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

export default function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      // pathname from @/i18n/navigation is locale-agnostic; router applies the new locale.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language")}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium outline-none",
          "text-[var(--text-secondary)] transition-colors",
          "hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]",
          "data-[state=open]:bg-[var(--accent-dim)] data-[state=open]:text-[var(--accent)]",
          isPending && "opacity-60",
        )}
      >
        <Flag locale={locale} />
        <span className="truncate">{t(labelKey[locale] ?? locale)}</span>
        <ChevronDown size={15} className="ml-auto shrink-0 opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={6}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onSelect={() => switchTo(loc)}
            className="cursor-pointer gap-2"
          >
            <Flag locale={loc} />
            <span className="truncate">{t(labelKey[loc] ?? loc)}</span>
            {loc === locale && (
              <Check size={15} className="ml-auto shrink-0 text-[var(--accent)]" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
