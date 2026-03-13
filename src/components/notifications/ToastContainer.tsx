'use client';

import React from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import Toast from './Toast';

export default function ToastContainer() {
  const { notifications, dismissNotification } = useNotificationStore();

  // Get all toasts that have a duration (auto-dismiss) AND are still shown
  const toasts = notifications.filter((n) => n.duration && n.isShown !== false);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none md:bottom-6 md:right-6"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <Toast notification={notification} onDismiss={dismissNotification} />
        </div>
      ))}
    </div>
  );
}
