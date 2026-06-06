import type { Metadata, Viewport } from "next";
import { Syne, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import LayoutClient from "./layout-client";
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
    "talentapp:project_verification": "8e7d88c649059a8b9ca547b2c4611ac999a2d7e09ca60083f58af1e1aaa10cb6937fcce415886641448b653b69b94b767b5e4fff6dfb9c6e2403420da36c4cc1",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${syne.variable} ${jetBrainsMono.variable} ${syne.className} antialiased`}
        suppressHydrationWarning
      >
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
