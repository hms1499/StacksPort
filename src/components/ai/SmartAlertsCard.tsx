"use client";

import type { AlertItem } from "@/lib/ai";
import AlertRow from "./AlertRow";

export default function SmartAlertsCard({ items }: { items: AlertItem[] }) {
  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Smart Alerts</h3>

      <div className="space-y-3">
        {items.map((alert, i) => (
          <AlertRow key={i} alert={alert} />
        ))}
      </div>
    </div>
  );
}
