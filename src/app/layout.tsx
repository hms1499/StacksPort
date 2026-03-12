import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StacksPort — Portfolio Manager",
  description: "Manage your Stacks blockchain portfolio",
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
    <html lang="en">
      <body className={`${geist.className} bg-gray-50 antialiased`} suppressHydrationWarning>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar — desktop only */}
          <div className="hidden md:block">
            <Sidebar />
          </div>

          {/* Main content — add bottom padding on mobile for BottomNav */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>

        {/* Bottom nav — mobile only */}
        <BottomNav />
      </body>
    </html>
  );
}
