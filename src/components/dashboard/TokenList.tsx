"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownLeft, Coins } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { getFungibleTokens, getTokenMetadata } from "@/lib/stacks";
import { formatSTX } from "@/lib/utils";
import SendModal, { SendTokenInfo } from "@/components/wallet/SendModal";
import ReceiveModal from "@/components/wallet/ReceiveModal";

interface FungibleToken {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  contractId: string;
  imageUri?: string;
}

const STX_IMAGE = "https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png";

function TokenList() {
  const { stxAddress, isConnected } = useWalletStore();
  const [tokens, setTokens] = useState<FungibleToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [stxOnly, setStxOnly] = useState<{ balance: string } | null>(null);
  const [sendToken, setSendToken] = useState<SendTokenInfo | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  useEffect(() => {
    if (!isConnected || !stxAddress) return;
    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return getFungibleTokens(stxAddress);
      })
      .then(async (data) => {
        if (cancelled) return;
        setStxOnly({ balance: data.stx?.balance ?? "0" });

        const list: FungibleToken[] = [];
        if (data.fungible_tokens) {
          for (const [contractId, info] of Object.entries(
            data.fungible_tokens as Record<string, { balance: string }>
          )) {
            const symbol = contractId.split("::")[1] ?? contractId.split(".")[1] ?? "???";
            list.push({
              contractId,
              symbol: symbol.toUpperCase(),
              name: symbol,
              balance: info.balance,
              decimals: 6,
            });
          }
        }

        const slice = list.slice(0, 8);
        const metadataResults = await Promise.allSettled(
          slice.map((t) => getTokenMetadata(t.contractId))
        );

        setTokens(slice.map((t, i) => {
          const result = metadataResults[i];
          const meta = result.status === "fulfilled" ? result.value : null;
          return {
            ...t,
            name: meta?.name ?? t.name,
            symbol: meta?.symbol?.toUpperCase() ?? t.symbol,
            decimals: meta?.decimals ?? t.decimals,
            imageUri: meta?.image_uri ?? undefined,
          };
        }));
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [stxAddress, isConnected]);

  if (!isConnected) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="font-semibold text-gray-700 mb-4">My Assets</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Coins size={32} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Connect your wallet to view assets</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">My Assets</h2>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
            {tokens.length + 1} tokens
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-20" />
                  <div className="h-3 bg-gray-100 rounded w-28" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {stxOnly && (
              <TokenRow
                symbol="STX"
                name="Stacks"
                balance={formatSTX(Number(stxOnly.balance))}
                imageUri={STX_IMAGE}
                fallbackColor="bg-teal-50"
                fallbackTextColor="text-teal-600"
                onSend={() => setSendToken({
                  symbol: "STX",
                  name: "Stacks",
                  rawBalance: stxOnly.balance,
                  decimals: 6,
                  contractId: "",
                  imageUri: STX_IMAGE,
                })}
                onReceive={() => setReceiveOpen(true)}
              />
            )}
            {tokens.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No other tokens found</p>
            )}
            {tokens.map((t) => (
              <TokenRow
                key={t.contractId}
                symbol={t.symbol.slice(0, 6)}
                name={t.name}
                balance={formatSTX(Number(t.balance))}
                imageUri={t.imageUri}
                fallbackColor="bg-blue-50"
                fallbackTextColor="text-blue-600"
                onSend={() => setSendToken({
                  symbol: t.symbol,
                  name: t.name,
                  rawBalance: t.balance,
                  decimals: t.decimals,
                  contractId: t.contractId,
                  imageUri: t.imageUri,
                })}
                onReceive={() => setReceiveOpen(true)}
              />
            ))}
          </div>
        )}
      </div>

      {sendToken && (
        <SendModal token={sendToken} onClose={() => setSendToken(null)} />
      )}
      {receiveOpen && (
        <ReceiveModal onClose={() => setReceiveOpen(false)} />
      )}
    </>
  );
}

function TokenAvatar({
  symbol,
  imageUri,
  fallbackColor,
  fallbackTextColor,
}: {
  symbol: string;
  imageUri?: string;
  fallbackColor: string;
  fallbackTextColor: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (imageUri && !imgError) {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUri}
          alt={symbol}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`w-10 h-10 rounded-full ${fallbackColor} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-xs font-bold ${fallbackTextColor}`}>{symbol.slice(0, 3)}</span>
    </div>
  );
}

const TokenRow = React.memo(function TokenRow({
  symbol,
  name,
  balance,
  imageUri,
  fallbackColor,
  fallbackTextColor,
  onSend,
  onReceive,
}: {
  symbol: string;
  name: string;
  balance: string;
  imageUri?: string;
  fallbackColor: string;
  fallbackTextColor: string;
  onSend: () => void;
  onReceive: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors group">
      <TokenAvatar
        symbol={symbol}
        imageUri={imageUri}
        fallbackColor={fallbackColor}
        fallbackTextColor={fallbackTextColor}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{symbol}</p>
        <p className="text-xs text-gray-400 truncate">{name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{balance}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onSend}
          title="Send"
          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
        >
          <ArrowUpRight size={12} className="text-green-600" />
        </button>
        <button
          onClick={onReceive}
          title="Receive"
          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <ArrowDownLeft size={12} className="text-blue-600" />
        </button>
      </div>
    </div>
  );
});

export default React.memo(TokenList);
