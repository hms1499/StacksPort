import type { Metadata } from "next";
import DCAPageWrapper from "@/components/dca/DCAPageWrapper";

export const metadata: Metadata = {
  title: "Automated DCA Vault",
  description:
    "Automate recurring STX to sBTC swaps on a schedule you control. Non-custodial, executed on-chain on Stacks mainnet.",
  alternates: { canonical: "/dca" },
};

export default function DCAPage() {
  return <DCAPageWrapper />;
}
