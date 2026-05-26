"use client";

import { GripVertical } from "lucide-react";
import { ReactNode } from "react";

type Props = {
  /** Hide the drag handle (eg. for banners that span full width and shouldn't be moved). */
  noDrag?: boolean;
  /** When false the widget renders without drag affordances (view mode). */
  isEditing?: boolean;
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
export default function WidgetShell({ noDrag, isEditing = false, children }: Props) {
  const showHandle = !noDrag && isEditing;
  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      {showHandle && (
        <button
          type="button"
          className="drag-handle absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-foreground p-1.5 rounded-md hover:bg-muted/50 transition-colors"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-auto [&>*]:h-full">
        {children}
      </div>
    </div>
  );
}
