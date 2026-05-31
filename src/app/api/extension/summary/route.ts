import { NextRequest, NextResponse } from "next/server";
import { CONTRACT_NAME_TO_GECKO } from "@/lib/token-registry";

const COINGECKO = "https://api.coingecko.com/api/v3";
const HIRO = "https://api.hiro.so";

// CORS (incl. OPTIONS preflight) is applied centrally in src/middleware.ts,
// scoped to the chrome-extension origin.

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  const STACKS_ADDRESS_RE = /^S[MP][A-Z0-9]{1,40}$/;

  if (address && !STACKS_ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const priceRes = await fetch(
      `${COINGECKO}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    const priceData = priceRes.ok ? await priceRes.json() : {};

    const stxUsd = priceData?.blockstack?.usd ?? 0;
    const btcUsd = priceData?.bitcoin?.usd ?? 0;

    const prices = {
      stx: stxUsd,
      sbtc: btcUsd,
      btc: btcUsd,
      stxChange24h: priceData?.blockstack?.usd_24h_change ?? 0,
      btcChange24h: priceData?.bitcoin?.usd_24h_change ?? 0,
    };

    let portfolio = { totalUSD: 0, stxBalance: 0 };
    if (address) {
      const balRes = await fetch(
        `${HIRO}/extended/v1/address/${address}/balances`,
        { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        const stxMicro = Number(balData?.stx?.balance ?? 0);
        const stxBalance = stxMicro / 1_000_000;
        let totalUSD = stxBalance * stxUsd;

        const geckoTokens: { geckoId: string; humanBalance: number }[] = [];
        if (balData.fungible_tokens) {
          for (const [contractId, info] of Object.entries(
            balData.fungible_tokens as Record<string, { balance: string }>
          )) {
            const contractName = contractId.split(".")[1]?.split("::")[0];
            const known = contractName
              ? CONTRACT_NAME_TO_GECKO[contractName]
              : null;
            const balance = Number((info as { balance: string }).balance);
            if (!known || balance <= 0) continue;

            const humanBalance = balance / Math.pow(10, known.decimals);

            if (known.fixedUsdPrice != null) {
              totalUSD += humanBalance * known.fixedUsdPrice;
            } else if (known.geckoId) {
              geckoTokens.push({ geckoId: known.geckoId, humanBalance });
            }
          }
        }

        if (geckoTokens.length > 0) {
          const geckoIds = [
            ...new Set(geckoTokens.map((t) => t.geckoId)),
          ].join(",");
          const tokenRes = await fetch(
            `${COINGECKO}/simple/price?ids=${geckoIds}&vs_currencies=usd`,
            { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
          );
          if (tokenRes.ok) {
            const tokenPrices = await tokenRes.json();
            for (const { geckoId, humanBalance } of geckoTokens) {
              totalUSD += humanBalance * (tokenPrices[geckoId]?.usd ?? 0);
            }
          }
        }

        portfolio = { totalUSD, stxBalance };
      }
    }

    return NextResponse.json({ prices, portfolio });
  } catch (err) {
    console.error("[extension/summary]", err);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
