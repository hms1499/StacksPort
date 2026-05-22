'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';

// Surfaced wherever price alerts are managed. The server is now the only
// alert evaluator (the client polling fallback was removed), so a user who
// hasn't granted notification permission will silently get nothing. Better
// to say so plainly.

export default function PushPermissionBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setShow(false);
      return;
    }
    setShow(Notification.permission !== 'granted');
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <BellRing size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Enable browser notifications to receive price alerts</p>
        <p className="mt-0.5 text-xs text-amber-800/80">
          Alerts now evaluate server-side and deliver via Web Push. Without permission, you won&apos;t be notified when a target price is hit.
        </p>
      </div>
    </div>
  );
}
