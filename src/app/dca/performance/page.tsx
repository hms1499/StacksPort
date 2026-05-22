import DCAPerformanceWrapper from "@/components/dca/performance/DCAPerformanceWrapper";

export const metadata = {
  title: "DCA Performance — StacksPort",
  description: "Cost basis and execution history for your STX → sBTC plans.",
};

export default function DCAPerformancePage() {
  return <DCAPerformanceWrapper />;
}
