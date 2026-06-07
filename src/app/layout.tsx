// Pass-through root layout. The real <html>/<body> live in
// src/app/[locale]/layout.tsx so the lang attribute can reflect the active
// locale. This file exists only because Next.js requires a root layout; the
// locale layout (and the global not-found) render their own document shell.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
