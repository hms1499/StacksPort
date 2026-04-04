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
  keeperPrivateKey:      string;
  keeperAddress:         string;
  batchExecutorContract: string; // "SP2CMK....batch-dca-executor"
  stxVaultContract:      string; // "SP2CMK....dca-vault"
  sbtcVaultContract:     string; // "SP2CMK....dca-vault-sbtc-v2"
  hiroApiUrl:            string;
  minAmountOut:          number;
}

function isMnemonic(value: string): boolean {
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
    for (let i = wallet.accounts.length; i <= accountIndex; i++) {
      wallet = generateNewAccount(wallet);
    }
    return wallet.accounts[accountIndex].stxPrivateKey;
  }
  throw new Error(
    "KEEPER_PRIVATE_KEY must be a 64-char hex private key or a 12/24-word mnemonic seed phrase"
  );
}

export async function loadConfig(): Promise<BotConfig> {
  const accountIndex    = Number(optional("KEEPER_ACCOUNT_INDEX", "1"));
  const keeperPrivateKey = await resolvePrivateKey(required("KEEPER_PRIVATE_KEY"), accountIndex);
  const keeperAddress   = required("KEEPER_ADDRESS");

  const derivedAddress = getAddressFromPrivateKey(keeperPrivateKey, "mainnet");
  if (derivedAddress !== keeperAddress) {
    throw new Error(
      `Address mismatch! Private key derives to ${derivedAddress} but KEEPER_ADDRESS is ${keeperAddress}.`
    );
  }

  return {
    keeperPrivateKey,
    keeperAddress,
    batchExecutorContract: optional(
      "BATCH_EXECUTOR_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.batch-dca-executor"
    ),
    stxVaultContract: optional(
      "STX_VAULT_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault"
    ),
    sbtcVaultContract: optional(
      "SBTC_VAULT_CONTRACT",
      "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.dca-vault-sbtc-v2"
    ),
    hiroApiUrl:   optional("HIRO_API_URL", "https://api.hiro.so"),
    minAmountOut: Number(optional("MIN_AMOUNT_OUT", "1")),
  };
}
