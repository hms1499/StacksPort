"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself (where the
 * normal error.tsx can't help). It replaces the whole document, so it must
 * render its own <html>/<body> and cannot rely on the app's CSS variables.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0b0b0f",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 360 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 18,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#5546ff",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
