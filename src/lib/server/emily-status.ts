export type EmilyDepositStatus = "pending" | "accepted" | "confirmed" | "failed" | "unknown";

export interface EmilyStatusClient {
  getDepositStatus(txid: string): Promise<EmilyDepositStatus>;
}

const KNOWN: EmilyDepositStatus[] = ["pending", "accepted", "confirmed", "failed"];

export function makeEmilyStatusClient(
  baseUrl: string = process.env.SBTC_EMILY_API_URL ?? "https://sbtc-emily.com",
): EmilyStatusClient {
  return {
    async getDepositStatus(txid: string): Promise<EmilyDepositStatus> {
      try {
        const res = await fetch(`${baseUrl}/deposit/${txid}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return "unknown";
        const body = (await res.json()) as { status?: string };
        const s = (body.status ?? "").toLowerCase() as EmilyDepositStatus;
        return KNOWN.includes(s) ? s : "unknown";
      } catch {
        return "unknown";
      }
    },
  };
}
