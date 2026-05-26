"use client";

import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

type Props = {
  /** Hide the drag handle (eg. for banners that span full width and shouldn't be moved). */
  noDrag?: boolean;
  children: ReactNode;
};

/**
 * Wraps a widget in a fixed-height container that fills the grid cell.
 * The drag handle floats as an overlay so it doesn't disturb the widget's own
 * card styling. The widget itself owns its `glass-card` look.
 *
 * `min-h-0` + `overflow-auto` lets long content (lists, tables) scroll inside
 * the cell instead of overflowing into neighbours when the cell is shrunk.
 */
export default function WidgetShell({ noDrag, children }: Props) {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      {!noDrag && (
        <button
          type="button"
          className="drag-handle absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-1.5 rounded-md hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
