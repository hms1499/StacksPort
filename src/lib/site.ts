const DEFAULT_SITE_URL = "https://stack-sport.vercel.app";

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
);

export const SITE_NAME = "StacksPort";
export const SITE_DESCRIPTION =
  "Automate non-custodial STX to sBTC DCA, track your Stacks portfolio, and execute swaps on-chain.";
