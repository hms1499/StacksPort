import { connect as stacksConnect } from "@stacks/connect";
import { track } from "./telemetry";

interface AddressEntry {
  address: string;
  symbol?: string;
}

export function parseWalletAddresses(addresses: AddressEntry[]) {
  const stxEntry = addresses.find(
    (a) => a.symbol === "STX" || a.address.startsWith("SP") || a.address.startsWith("ST")
  );
  const btcEntry = addresses.find(
    (a) => a.symbol === "BTC" || (!a.address.startsWith("SP") && !a.address.startsWith("ST"))
  );
  return {
    stxAddress: stxEntry?.address ?? addresses[0]?.address ?? "",
    btcAddress: btcEntry?.address ?? "",
  };
}

export async function connectWallet(connect: (stxAddress: string, btcAddress: string) => void) {
  const result = await stacksConnect();
  const { stxAddress, btcAddress } = parseWalletAddresses(result.addresses);
  connect(stxAddress, btcAddress);
  // Funnel: single choke point for every connect entry (topbar, landing,
  // modal, backtest hero CTA).
  track("wallet_connected");
  return { stxAddress, btcAddress };
}
