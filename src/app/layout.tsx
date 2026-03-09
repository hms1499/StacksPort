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
    "talentapp:project_verification": "027544986f44d93d97a520378aecdbf1c0e6cd627c71e3c58bc45e77e7257c9ed9d05c8d2989f06a68d50aa3aa85da14511ffabc33a12715269e3c3f07ad37d2",
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
