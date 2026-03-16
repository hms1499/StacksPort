import "dotenv/config";
import { generateWallet, generateNewAccount } from "@stacks/wallet-sdk";
import { getAddressFromPrivateKey } from "@stacks/transactions";

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

async function resolvePrivateKey(raw: string, accountIndex: number): Promise<string> {
  if (isHexKey(raw)) {
    return raw.replace(/^0x/i, "").trim();
  }

  if (isMnemonic(raw)) {
    let wallet = await generateWallet({ secretKey: raw.trim(), password: "" });
    // generateWallet creates account 0; add more accounts as needed
    for (let i = wallet.accounts.length; i <= accountIndex; i++) {
      wallet = generateNewAccount(wallet);
    }
    const account = wallet.accounts[accountIndex];
    // stxPrivateKey is hex, may have "01" suffix for compressed
    return account.stxPrivateKey;
  }

  throw new Error(
    "KEEPER_PRIVATE_KEY must be a 64-char hex private key or a 12/24-word mnemonic seed phrase"
  );
}

export async function loadConfig(): Promise<BotConfig> {
  const accountIndex = Number(optional("KEEPER_ACCOUNT_INDEX", "1")); // Account 2 in wallet = index 1
  const keeperPrivateKey = await resolvePrivateKey(required("KEEPER_PRIVATE_KEY"), accountIndex);
  const keeperAddress = required("KEEPER_ADDRESS");

  // Verify that the private key matches the expected address
  const derivedAddress = getAddressFromPrivateKey(keeperPrivateKey, "mainnet");
  if (derivedAddress !== keeperAddress) {
    throw new Error(
      `Address mismatch! Private key derives to ${derivedAddress} but KEEPER_ADDRESS is ${keeperAddress}. ` +
      `Make sure the mnemonic/key and address belong to the same wallet.`
    );
  }

  return {
    keeperPrivateKey,
    keeperAddress,
    contractAddress:  optional("CONTRACT_ADDRESS", "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV"),
    contractName:     optional("CONTRACT_NAME", "dca-vault"),
    swapRouter:       optional("SWAP_ROUTER", "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router"),
    hiroApiUrl:       optional("HIRO_API_URL", "https://api.hiro.so"),
    pollIntervalMs:   Number(optional("POLL_INTERVAL_MS", "120000")),
    minAmountOut:     Number(optional("MIN_AMOUNT_OUT", "0")),
  };
}
