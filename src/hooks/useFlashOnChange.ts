"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a CSS class name that flashes positive/negative briefly
 * when `value` changes compared to its previous value.
 *
 * Wires into the .flash-positive / .flash-negative animations defined
 * in globals.css.
 *
 * @param value Numeric value to watch.
 * @param duration How long the class stays applied in ms. Should match
 *                 the CSS animation duration. Default 500.
 */
export function useFlashOnChange(value: number | undefined, duration = 500): string {
  const prev = useRef(value);
  const [cls, setCls] = useState("");

  useEffect(() => {
    if (value === undefined || prev.current === undefined) {
      prev.current = value;
      return;
    }
    if (value === prev.current) return;

    const next = value > prev.current ? "flash-positive" : "flash-negative";
    prev.current = value;
    setCls(next);
    const id = setTimeout(() => setCls(""), duration);
    return () => clearTimeout(id);
  }, [value, duration]);

  return cls;
}
