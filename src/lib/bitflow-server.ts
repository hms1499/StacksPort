import { BitflowSDK } from "@bitflowlabs/core-sdk";

// Server-side singleton
// Default hosts are the SDK's built-in values — override via env vars if needed
export const bitflow = new BitflowSDK({
  BITFLOW_API_HOST:
    process.env.BITFLOW_API_HOST ??
    "https://bitflowsdk-api-test-7owjsmt8.uk.gateway.dev",
  BITFLOW_API_KEY: process.env.BITFLOW_API_KEY,
  READONLY_CALL_API_HOST:
    process.env.READONLY_CALL_API_HOST ??
    "https://node.bitflowapis.finance",
  READONLY_CALL_API_KEY: process.env.READONLY_CALL_API_KEY,
  BITFLOW_PROVIDER_ADDRESS: process.env.BITFLOW_PROVIDER_ADDRESS,
  KEEPER_API_HOST:
    process.env.KEEPER_API_HOST ??
    "https://bitflow-keeper-test-7owjsmt8.uc.gateway.dev",
});
