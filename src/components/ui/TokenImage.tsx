"use client";

import Image from "next/image";
import { useState } from "react";

type Fallback = "initials" | "none";

/**
 * The Next.js image optimizer 400s on SVG (without `dangerouslyAllowSVG`, which
 * we keep off because remotePatterns is `**`) and can't process data URLs.
 * Such sources must be served as-is via `unoptimized` — otherwise local
 * `/tokens/*.svg` icons would silently fail to load.
 */
export function shouldBypassOptimizer(src: string): boolean {
  return /\.svg(\?|$)/i.test(src) || src.startsWith("data:");
}

type TokenImageProps = {
  /** Logo URL. May be missing or point at a host/format the optimizer rejects. */
  src?: string | null;
  /** Token symbol — used for alt text and the initials fallback. */
  symbol: string;
  /** Rendered square size in px. */
  size?: number;
  /** Extra classes merged onto the wrapper (e.g. a ring). */
  className?: string;
  /** What to show when there is no logo / it fails to load. */
  fallback?: Fallback;
  /** Background of the initials fallback circle. */
  fallbackClassName?: string;
  /** Text colour of the initials fallback. */
  fallbackTextClassName?: string;
};

/**
 * Shared token logo. Replaces the ad-hoc raw `<img>` avatars that were
 * scattered across the assets / trade / dashboard components.
 *
 * Uses next/image (lazy-loaded, optimized, no layout shift) with a graceful
 * fallback: anything the loader can't render (missing src, SVG/data URLs the
 * optimizer rejects, network errors) falls back to the symbol initials, or to
 * nothing when `fallback="none"`.
 */
export function TokenImage({
  src,
  symbol,
  size = 36,
  className = "",
  fallback = "initials",
  fallbackClassName = "bg-[#B0E4CC]/20",
  fallbackTextClassName = "text-[#285A48]",
}: TokenImageProps) {
  // Track the src that failed (not a bare boolean) so a new src auto-recovers —
  // the component may be reused with a different token (e.g. a hover tooltip)
  // without remounting.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const box = { width: size, height: size };

  if (src && failedSrc !== src) {
    const unoptimized = shouldBypassOptimizer(src);
    return (
      <div
        className={`relative rounded-full overflow-hidden shrink-0 bg-gray-50 ${className}`}
        style={box}
      >
        <Image
          src={src}
          alt={symbol}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized={unoptimized}
          onError={() => setFailedSrc(src)}
        />
      </div>
    );
  }

  if (fallback === "none") return null;

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 ${fallbackClassName} ${className}`}
      style={box}
    >
      <span className={`text-xs font-bold ${fallbackTextClassName}`}>
        {symbol.slice(0, 3)}
      </span>
    </div>
  );
}

export default TokenImage;
