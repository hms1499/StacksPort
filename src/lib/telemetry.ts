"use client";

// Fire-and-forget client telemetry. We POST to /api/telemetry which
// increments a per-day Redis counter. No PII is sent — just the event name.
// Goal is to answer aggregate questions like "what % of dashboard sessions
// actually customize the layout" before investing in cross-device persistence.

export type TelemetryEvent =
  | "dashboard_viewed"
  | "dashboard_edit_mode_on"
  | "dashboard_edit_mode_off"
  | "dashboard_layout_mutated"
  | "dashboard_layout_reset";

export function track(event: TelemetryEvent): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ event });
    // sendBeacon survives page unload; falls back to fetch keepalive.
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/telemetry", blob);
      return;
    }
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow — telemetry must never break the app.
  }
}
