"use client";

import { GripVertical, RefreshCw } from "lucide-react";
import { KeyboardEvent, ReactNode, useState } from "react";

export type KeyboardMoveHandler = (
  id: string,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) => void;

type Props = {
  /** Hide the drag handle (eg. for banners that span full width and shouldn't be moved). */
  noDrag?: boolean;
  /** When false the widget renders without drag affordances (view mode). */
  isEditing?: boolean;
  /** Stable widget id; required for keyboard move callbacks. */
  widgetId?: string;
  /** Human-friendly label used by aria-label on the drag handle. */
  widgetLabel?: string;
  /** Invoked when arrow keys (move) or shift+arrow (resize) are pressed while the handle is focused. */
  onKeyboardMove?: KeyboardMoveHandler;
  /** When set, a hover-reveal refresh button revalidates the widget's data source. */
  onRefresh?: () => Promise<unknown> | void;
  children: ReactNode;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps a widget in a fixed-height container that fills the grid cell.
 * The drag handle floats as an overlay so it doesn't disturb the widget's own
 * card styling. The widget itself owns its `glass-card` look.
 *
 * `min-h-0` + `overflow-auto` lets long content (lists, tables) scroll inside
 * the cell instead of overflowing into neighbours when the cell is shrunk.
 *
 * Keyboard a11y: when editing, focus the drag handle and use arrow keys to
 * move the widget one grid cell at a time, or shift+arrow to resize. RGL has
 * no native keyboard support — this fills that gap.
 */
export default function WidgetShell({
  noDrag,
  isEditing = false,
  widgetId,
  widgetLabel,
  onKeyboardMove,
  onRefresh,
  children,
}: Props) {
  const showHandle = !noDrag && isEditing;
  const showRefresh = !!onRefresh && !isEditing && !noDrag;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      // Floor the spin at 400ms so a cache-hit revalidation still reads as a
      // deliberate refresh rather than an imperceptible flicker.
      await Promise.all([onRefresh(), delay(400)]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!onKeyboardMove || !widgetId) return;
    const shift = e.shiftKey;
    let dx = 0, dy = 0, dw = 0, dh = 0;
    switch (e.key) {
      case "ArrowUp":    if (shift) dh = -1; else dy = -1; break;
      case "ArrowDown":  if (shift) dh =  1; else dy =  1; break;
      case "ArrowLeft":  if (shift) dw = -1; else dx = -1; break;
      case "ArrowRight": if (shift) dw =  1; else dx =  1; break;
      case "Escape":     (e.currentTarget as HTMLButtonElement).blur(); return;
      default: return;
    }
    e.preventDefault();
    onKeyboardMove(widgetId, dx, dy, dw, dh);
  };

  const label = widgetLabel ?? "widget";
  const ariaLabel = showHandle
    ? `Reorder ${label}. Arrow keys to move, shift plus arrow keys to resize, Escape to exit.`
    : `Drag ${label} to reorder`;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      {showHandle && (
        <button
          type="button"
          className="drag-handle absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 p-1.5 rounded-md hover:bg-muted/50 transition-colors"
          aria-label={ariaLabel}
          title="Drag or use arrow keys to reorder"
          onKeyDown={handleKeyDown}
        >
          <GripVertical size={14} />
        </button>
      )}
      {showRefresh && (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-fg-muted hover:text-brand hover:bg-sunken opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1 transition-opacity disabled:cursor-default"
          aria-label={`Refresh ${label}`}
          title="Refresh"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-auto [&>*]:h-full">
        {children}
      </div>
    </div>
  );
}
