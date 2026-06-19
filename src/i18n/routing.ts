import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "vi", "zh", "ja", "ko", "es"],
  defaultLocale: "en",
  // English keeps unprefixed URLs (/dashboard); other locales prefixed (/vi/dashboard)
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
