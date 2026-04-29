import type { Metadata } from "next";
import AppsPageWrapper from "@/components/apps/AppsPageWrapper";

export const metadata: Metadata = {
  title: "Connected Apps",
};

export default function AppsPage() {
  return <AppsPageWrapper />;
}
