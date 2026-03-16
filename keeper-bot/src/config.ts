import "dotenv/config";
import { generateWallet } from "@stacks/wallet-sdk";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface BotConfig {
  keeperPrivateKey: string;
  keeperAddress: string;
  contractAddress: string;
  contractName: string;
  swapRouter: string;
  hiroApiUrl: string;
  pollIntervalMs: number;
  minAmountOut: number;
}

function isMnemonic(value: string): boolean {
  // Mnemonic = multiple words separated by spaces (typically 24 words)
  return value.trim().split(/\s+/).length >= 12;
}

function isHexKey(value: string): boolean {
  const cleaned = value.replace(/^0x/i, "").trim();
  return /^[0-9a-fA-F]{64}(01)?$/.test(cleaned);
}

async function resolvePrivateKey(raw: string): Promise<string> {
  if (isHexKey(raw)) {
    return raw.replace(/^0x/i, "").trim();
  }

  if (isMnemonic(raw)) {
    const wallet = await generateWallet({ secretKey: raw.trim(), password: "" });
    const account = wallet.accounts[0];
    // stxPrivateKey is hex, may have "01" suffix for compressed
    return account.stxPrivateKey;
  }

  throw new Error(
    "KEEPER_PRIVATE_KEY must be a 64-char hex private key or a 12/24-word mnemonic seed phrase"
  );
}

export async function loadConfig(): Promise<BotConfig> {
  const keeperPrivateKey = await resolvePrivateKey(required("KEEPER_PRIVATE_KEY"));

  return {
    keeperPrivateKey,
    keeperAddress:    required("KEEPER_ADDRESS"),
    contractAddress:  optional("CONTRACT_ADDRESS", "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV"),
    contractName:     optional("CONTRACT_NAME", "dca-vault"),
    swapRouter:       optional("SWAP_ROUTER", "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router"),
    hiroApiUrl:       optional("HIRO_API_URL", "https://api.hiro.so"),
    pollIntervalMs:   Number(optional("POLL_INTERVAL_MS", "120000")),
    minAmountOut:     Number(optional("MIN_AMOUNT_OUT", "0")),
  };
}
