import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Creates a GSAP context scoped to a container ref.
 * All GSAP animations inside `callback` are auto-reverted on unmount.
 *
 * @param callback - receives the scoped gsap context's `self` for selector scoping
 * @param deps - React dependency array (default: [])
 * @returns containerRef to attach to the root DOM element
 */
export function useGSAP<T extends HTMLElement = HTMLDivElement>(
  callback: (self: gsap.Context) => void,
  deps: React.DependencyList = []
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      callback(ctx!);
    }, containerRef.current);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}
