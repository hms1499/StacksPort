import { Suspense } from "react";
import NotificationsPageWrapper from "@/components/notifications/NotificationsPageWrapper";

export const metadata = {
  title: "Notifications — StacksPort",
  description: "View all your notifications",
};

export default function NotificationsPage() {
  return (
    <Suspense>
      <NotificationsPageWrapper />
    </Suspense>
  );
}
