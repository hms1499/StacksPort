"use client";

import { useTranslations } from "next-intl";
import Topbar from "@/components/layout/Topbar";
import AnimatedPage from "@/components/motion/AnimatedPage";
import StaggerChildren from "@/components/motion/StaggerChildren";

export default function EarnPageContent() {
  const t = useTranslations("earn");
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={t("title")} />
      <AnimatedPage className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <StaggerChildren className="space-y-4 md:space-y-5">
          <>
            {/* Components mounted in Task 5 */}
          </>
        </StaggerChildren>
      </AnimatedPage>
    </div>
  );
}
