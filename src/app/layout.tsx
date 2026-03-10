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
    "talentapp:project_verification": "60874f6e194b163b7f9e8aafd0833a3e2a7bfbc502d21e614333c6f35ecb76f7396c6fb598ed4024cf28d55f013c97ad4dca545f00f3c2924a37a31f36a38151",
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
      <body className={`${geist.className} bg-gray-50 antialiased`}>
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
