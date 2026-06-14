import type { Metadata, Viewport } from "next";
import { Syne, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "../globals.css";
import LayoutClient from "../layout-client";
import { routing } from "@/i18n/routing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

// CJK fallback. Syne/JetBrains ship latin only, so Chinese glyphs would hit the
// system font. No `subsets` (CJK is delivered as many unicode-range chunks the
// browser lazy-loads) and `preload: false` (the full face is large — don't block
// first paint; it loads on demand when zh text is present).
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "StacksPort - Non-Custodial sBTC DCA on Stacks",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Stacks",
    "sBTC",
    "STX",
    "DCA",
    "Bitcoin DeFi",
    "non-custodial",
    "portfolio tracker",
  ],
  manifest: "/manifest.webmanifest",
  other: {
    "talentapp:project_verification":
      "8e7d88c649059a8b9ca547b2c4611ac999a2d7e09ca60083f58af1e1aaa10cb6937fcce415886641448b653b69b94b767b5e4fff6dfb9c6e2403420da36c4cc1",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${syne.variable} ${jetBrainsMono.variable} ${notoSansSC.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider>
          <LayoutClient>{children}</LayoutClient>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
