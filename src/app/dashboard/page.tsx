import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import DashboardFooter from "@/components/dashboard/DashboardFooter";
import DashboardGridClient from "@/components/dashboard/DashboardGridClient";

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Dashboard" />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <DashboardGridClient />
        <DashboardFooter />
      </AnimatedPage>
    </div>
  );
}
