import "dotenv/config";

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

export function loadConfig(): BotConfig {
  return {
    keeperPrivateKey: required("KEEPER_PRIVATE_KEY"),
    keeperAddress:    required("KEEPER_ADDRESS"),
    contractAddress:  optional("CONTRACT_ADDRESS", "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV"),
    contractName:     optional("CONTRACT_NAME", "dca-vault"),
    swapRouter:       optional("SWAP_ROUTER", "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.bitflow-sbtc-swap-router"),
    hiroApiUrl:       optional("HIRO_API_URL", "https://api.hiro.so"),
    pollIntervalMs:   Number(optional("POLL_INTERVAL_MS", "120000")),
    minAmountOut:     Number(optional("MIN_AMOUNT_OUT", "0")),
  };
}
