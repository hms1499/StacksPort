"use client";

import React, { type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { track } from "@/lib/telemetry";

type Props = {
  widgetId?: string;
  widgetLabel?: string;
  children: ReactNode;
};

type State = { error: Error | null };

// Class component because React still requires a class for error boundaries
// (no hook equivalent as of React 19). One instance per widget so a single
// failing card can't take down the whole grid.
export default class WidgetErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[WidgetErrorBoundary] ${this.props.widgetId ?? "widget"} threw:`,
        error,
        info.componentStack,
      );
    }
    track("dashboard_widget_error");
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    const label = this.props.widgetLabel ?? "this widget";
    return (
      <div
        role="alert"
        className="glass-card rounded-2xl p-5 h-full flex flex-col items-center justify-center text-center gap-3"
      >
        <AlertTriangle
          size={22}
          style={{ color: "var(--negative)" }}
          aria-hidden
        />
        <div className="space-y-1">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Couldn&apos;t load {label}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Something went wrong rendering this card.
          </p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: "var(--accent-text)",
            backgroundColor: "var(--bg-elevated)",
          }}
        >
          <RotateCcw size={12} />
          Retry
        </button>
      </div>
    );
  }
}
