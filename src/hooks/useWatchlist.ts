"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

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

// Shared in-memory state so every useWatchlist() consumer sees the same Set
// without waiting for a re-render or another tab's storage event.
let current: Set<string> = new Set();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  current = readStorage();
  hydrated = true;
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Set<string> {
  return current;
}

function getServerSnapshot(): Set<string> {
  return current;
}

function setIds(next: Set<string>) {
  current = next;
  writeStorage(next);
  emit();
}

// Sync from other tabs/windows. Attached once at module load.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    current = readStorage();
    emit();
  });
}

export function useWatchlist() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Trigger hydration on mount so the first paint matches localStorage.
  useEffect(() => {
    if (!hydrated) {
      current = readStorage();
      hydrated = true;
      emit();
    }
  }, []);

  const toggle = useCallback((id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setIds(next);
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, has, toggle, size: ids.size };
}
