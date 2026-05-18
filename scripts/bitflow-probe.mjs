import { BitflowSDK } from "@bitflowlabs/core-sdk";

const bitflow = new BitflowSDK({
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

const tokens = await bitflow.getAvailableTokens();

console.log("symbol\ttoken-id\ttokenContract\ttokenDecimals");
for (const token of tokens) {
  console.log(
    `${token.symbol}\t${token["token-id"]}\t${token.tokenContract ?? "null"}\t${token.tokenDecimals}`
  );
}
