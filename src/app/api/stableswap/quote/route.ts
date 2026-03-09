import { NextRequest, NextResponse } from "next/server";
import {
  contractPrincipalCV,
  uintCV,
  cvToHex,
  hexToCV,
  ClarityType,
} from "@stacks/transactions";

const CORE_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const CORE_NAME = "stableswap-core-v-1-4";
const POOL_ADDRESS = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const POOL_NAME = "stableswap-pool-aeusdc-usdcx-v-1-1";
const AEUSDC_ADDRESS = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
const AEUSDC_NAME = "token-aeusdc";
const USDCX_ADDRESS = "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE";
const USDCX_NAME = "usdcx";

// direction: "x-to-y" = aeUSDC → USDCx, "y-to-x" = USDCx → aeUSDC
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const direction = searchParams.get("direction");
  const amount = Number(searchParams.get("amount") ?? "0");

  if (!direction || !amount || amount <= 0) {
    return NextResponse.json({ error: "Missing params: direction, amount" }, { status: 400 });
  }

  const functionName = direction === "x-to-y" ? "get-dy" : "get-dx";
  const amountMicro = Math.round(amount * 1e6);

  const args = [
    cvToHex(contractPrincipalCV(POOL_ADDRESS, POOL_NAME)),
    cvToHex(contractPrincipalCV(AEUSDC_ADDRESS, AEUSDC_NAME)),
    cvToHex(contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME)),
    cvToHex(uintCV(BigInt(amountMicro))),
  ];

  try {
    const res = await fetch(
      `https://api.hiro.so/v2/contracts/call-read/${CORE_ADDRESS}/${CORE_NAME}/${functionName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: "SP000000000000000000002Q6VF78",
          arguments: args,
        }),
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) throw new Error(`Hiro API error: ${res.status}`);
    const data = await res.json();
    if (!data.okay || !data.result) throw new Error("Contract call failed");

    const resultCV = hexToCV(data.result);
    if (resultCV.type === ClarityType.ResponseOk) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const microOutput = Number((resultCV.value as any).value);
      return NextResponse.json({ output: microOutput / 1e6 });
    }
    throw new Error("Contract returned error response");
  } catch (e) {
    console.error("[stableswap/quote]", e);
    return NextResponse.json({ error: "Failed to get quote" }, { status: 500 });
  }
}
