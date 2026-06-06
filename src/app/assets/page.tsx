import type { Metadata } from "next";
import AssetsPageWrapper from "@/components/assets/AssetsPageWrapper";

export const metadata: Metadata = {
  title: "Portfolio & Holdings",
  description:
    "See your Stacks holdings, PnL, and stacking rewards. Non-custodial tracking on Stacks mainnet.",
  alternates: { canonical: "/assets" },
};

export default function AssetsPage() {
  return <AssetsPageWrapper />;
}
