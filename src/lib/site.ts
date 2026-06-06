const DEFAULT_SITE_URL = "https://stack-sport.vercel.app";

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  // Vercel injects host-only values (e.g. "stack-sport.vercel.app") with no
  // scheme; new URL() then throws "Invalid URL" and breaks the build. Ensure a
  // protocol is always present.
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
);

export const SITE_NAME = "StacksPort";
export const SITE_DESCRIPTION =
  "Automate non-custodial STX to sBTC DCA, track your Stacks portfolio, and execute swaps on-chain.";
