// src/lib/domain/swap/amount.ts
// Money math kept in BigInt where the on-chain amount is the value. Float
// `human * 10**decimals` loses precision for 8-decimal tokens with large
// integer parts — these helpers don't.

/**
 * STX kept back when the user taps MAX, so the swap transaction can still
 * pay its contract-call fee. Native STX is both the asset being spent and
 * the fee currency — without this buffer a 100% STX swap always reverts.
 */
export const STX_GAS_RESERVE = 0.1;

/**
 * Convert a human-readable amount to raw integer units without float math.
 * `1.5` STX → `1500000n`. Fraction beyond `decimals` is truncated (floor),
 * matching on-chain behaviour.
 */
export function toRawAmount(human: string | number, decimals: number): bigint {
  const str = typeof human === "number" ? human.toFixed(decimals) : human.trim();
  if (!str || isNaN(Number(str))) return 0n;
  const neg = str.startsWith("-");
  const [intPart, fracPart = ""] = str.replace(/^[+-]/, "").split(".");
  const frac = fracPart.slice(0, decimals).padEnd(decimals, "0");
  const raw = BigInt((intPart || "0") + frac);
  return neg ? -raw : raw;
}

/**
 * Apply a slippage tolerance (percent) to a raw output amount, flooring.
 * `applySlippageFloor(1000000n, 0.5)` → `995000n`. Uses basis points so
 * fractional percents stay exact.
 */
export function applySlippageFloor(
  amountOutRaw: bigint,
  slippagePercent: number
): bigint {
  const bps = BigInt(Math.round(slippagePercent * 100));
  return (amountOutRaw * (10000n - bps)) / 10000n;
}

/**
 * Sanitize a raw `<input>` value into a safe decimal string: digits and a
 * single dot only (no `e`/`+`/`-`/exponent/locale separators), fraction
 * truncated to the token's decimals. Keeps the amount field from ever
 * holding a value the contract math can't represent.
 */
export function sanitizeAmountInput(raw: string, decimals: number): string {
  if (!raw) return "";
  let s = raw.replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (s.startsWith(".")) s = "0" + s;
  const dot = s.indexOf(".");
  if (dot !== -1 && decimals >= 0) {
    s = s.slice(0, dot + 1 + decimals);
  }
  return s;
}

/**
 * Amount (human string) to put in the input when a balance-percent shortcut
 * is tapped. For a native-STX MAX it subtracts the gas reserve; everything
 * else is a straight `balance * pct`. Result is capped at 6 decimals.
 */
export function amountForPercent(
  balance: number,
  pct: number,
  isNativeStx: boolean,
  decimals: number
): string {
  let val = balance * pct;
  if (isNativeStx && pct >= 1) {
    val = Math.max(balance - STX_GAS_RESERVE, 0);
  }
  const places = Math.min(decimals, 6);
  return parseFloat(val.toFixed(places)).toString();
}

/**
 * True when `amountIn` (a human decimal string) strictly exceeds
 * `balanceHuman`, compared in raw integer units — consistent with how every
 * other money comparison in this module works (via `toRawAmount`) and immune
 * to any decimal-precision edge. Caller must only pass a known balance.
 */
export function exceedsBalance(
  amountIn: string,
  balanceHuman: number,
  decimals: number
): boolean {
  return toRawAmount(amountIn, decimals) > toRawAmount(balanceHuman, decimals);
}
