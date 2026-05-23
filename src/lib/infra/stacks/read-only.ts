// src/lib/infra/stacks/read-only.ts
// Adapter: Hiro `call-read` HTTP endpoint → ClarityValue. The only place in
// the swap stack that performs network I/O for read-only contract calls.
// Decodes via the domain-layer hexToCV.

import { hexToCV } from "@/lib/domain/swap/clarity";
import type { ClarityValue } from "@stacks/transactions";

const HIRO_API = "https://api.hiro.so";

// Any valid mainnet principal — the call is read-only, so the sender is
// never charged and never validated against state. Using a fixed address
// keeps the call deterministic.
const DUMMY_SENDER = "SP000000000000000000002Q6VF78";

export async function callReadOnly(
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: string[]
): Promise<ClarityValue> {
  const res = await fetch(
    `${HIRO_API}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DUMMY_SENDER, arguments: args }),
    }
  );
  const data = await res.json();
  if (!data.okay) throw new Error(data.cause ?? "Read-only call failed");
  return hexToCV(data.result);
}
