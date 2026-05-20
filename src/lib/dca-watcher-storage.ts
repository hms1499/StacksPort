const KEY_PREFIX = 'dca-watcher-seen:';
const MAX_TXIDS = 500;

// Low-balance warning được throttle 24h per plan để tránh spam mỗi 60s tick.
const LOW_BALANCE_WARN_TTL_MS = 24 * 60 * 60 * 1000;

export interface SeenStore {
  txids: string[];
  baselineDoneAt: number; // 0 = chưa baseline; ms timestamp khi xong
  // planId → timestamp khi warning lần cuối được gửi
  lowBalanceWarnedAt?: Record<number, number>;
}

function emptyStore(): SeenStore {
  return { txids: [], baselineDoneAt: 0 };
}

function storageKey(address: string): string {
  return `${KEY_PREFIX}${address.toLowerCase()}`;
}

export function loadSeen(address: string): SeenStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<SeenStore>;
    return {
      txids: Array.isArray(parsed.txids) ? parsed.txids : [],
      baselineDoneAt: typeof parsed.baselineDoneAt === 'number' ? parsed.baselineDoneAt : 0,
    };
  } catch {
    return emptyStore();
  }
}

export function saveSeen(address: string, store: SeenStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(store));
  } catch {
    // quota exceeded / private mode — silently ignore
  }
}

export function isBaselined(store: SeenStore): boolean {
  return store.baselineDoneAt > 0;
}

export function markBaselined(store: SeenStore): SeenStore {
  return { ...store, baselineDoneAt: Date.now() };
}

/**
 * Add new txids to the seen set, dedup, FIFO trim to MAX_TXIDS.
 */
export function markSeen(store: SeenStore, txids: string[]): SeenStore {
  if (txids.length === 0) return store;
  const set = new Set(store.txids);
  for (const id of txids) set.add(id);
  let next = Array.from(set);
  if (next.length > MAX_TXIDS) {
    next = next.slice(next.length - MAX_TXIDS);
  }
  return { ...store, txids: next };
}

export function hasSeen(store: SeenStore, txid: string): boolean {
  return store.txids.includes(txid);
}

// Kiểm tra xem plan này đã được warn trong 24h gần nhất chưa
export function hasWarnedLowBalance(store: SeenStore, planId: number): boolean {
  const warnedAt = store.lowBalanceWarnedAt?.[planId];
  if (!warnedAt) return false;
  return Date.now() - warnedAt < LOW_BALANCE_WARN_TTL_MS;
}

export function markLowBalanceWarned(store: SeenStore, planId: number): SeenStore {
  return {
    ...store,
    lowBalanceWarnedAt: { ...(store.lowBalanceWarnedAt ?? {}), [planId]: Date.now() },
  };
}
