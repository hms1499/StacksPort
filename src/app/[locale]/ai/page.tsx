import { Suspense } from "react";
import AIPageWrapper from "@/components/ai/AIPageWrapper";

export const metadata = {
  title: "Stacks AI — StacksPort",
  description: "AI-powered market intelligence for the Stacks ecosystem",
};

export default function AIPage() {
  return (
    <Suspense>
      <AIPageWrapper />
    </Suspense>
  );
}
