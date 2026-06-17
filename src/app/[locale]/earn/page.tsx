import type { Metadata } from "next";
import EarnPageWrapper from "@/components/earn/EarnPageWrapper";

export const metadata: Metadata = {
  title: "Earn — Stacking & Yield",
  description:
    "Put your STX to work. Liquid stacking, yield opportunities, and your earning positions on Stacks mainnet.",
  alternates: { canonical: "/earn" },
};

export default function EarnPage() {
  return <EarnPageWrapper />;
}
