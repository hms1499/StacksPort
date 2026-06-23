import {
  serializeCV, hexToCV, cvToJSON, standardPrincipalCV, type ClarityValue,
} from "@stacks/transactions";
import { buildSbtcPosition, type ZestPosition } from "@/lib/domain/zest/position";
import { ZSBTC_ATOKEN } from "@/lib/domain/zest/contracts";

const HIRO_API = "https://api.hiro.so";
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

function cvHex(cv: ClarityValue): string {
  const r = serializeCV(cv);
  return "0x" + (typeof r === "string" ? r : Buffer.from(r as Uint8Array).toString("hex"));
}

export async function getZestSbtcPosition(address: string): Promise<ZestPosition | null> {
  try {
    const res = await fetch(
      `${HIRO_API}/v2/contracts/call-read/${ZSBTC_ATOKEN.address}/${ZSBTC_ATOKEN.name}/get-principal-balance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: DUMMY_SENDER, arguments: [cvHex(standardPrincipalCV(address))] }),
        signal: AbortSignal.timeout(8_000),
      }
    );
    const json = await res.json();
    if (!json.okay) return null;
    const parsed = cvToJSON(hexToCV(json.result)) as { value?: { value?: string } | string };
    const raw = (parsed.value as { value?: string })?.value ?? (parsed.value as string);
    const sats = Number(raw);
    return Number.isFinite(sats) ? buildSbtcPosition(sats) : null;
  } catch {
    return null;
  }
}
