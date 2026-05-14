"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "stacksport.bubbles.watchlist.v1";

function readStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeStorage(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

export function useWatchlist() {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIds(readStorage());
    setHydrated(true);
  }, []);

  // Sync across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setIds(readStorage());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeStorage(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, has, toggle, hydrated, size: ids.size };
}
