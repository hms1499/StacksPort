'use client';

import { useEffect, useRef } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { useNotificationStore } from '@/store/notificationStore';
import {
  getUserPlans,
  getPlanExecutionHistory,
  microToSTX,
  type DCAPlan,
  type PlanExecutionEvent,
} from '@/lib/dca';
import {
  loadSeen,
  saveSeen,
  isBaselined,
  markBaselined,
  markSeen,
} from '@/lib/dca-watcher-storage';

const POLL_INTERVAL_MS = 60_000;

type AddNotificationFn = ReturnType<typeof useNotificationStore.getState>['addNotification'];

export function useDcaExecutionWatcher(): void {
  const stxAddress = useWalletStore((s) => s.stxAddress);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Ref so async loops always see latest fn without re-subscribing
  const addNotificationRef = useRef(addNotification);
  useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);

  useEffect(() => {
    if (!stxAddress) return;
    const address = stxAddress;
    let cancelled = false;
    let isRunning = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isRunning) return;
      isRunning = true;
      try {
        await runTick(address, addNotificationRef.current);
      } catch {
        // never throw out of interval callback
      } finally {
        isRunning = false;
      }
    };

    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        // catch-up immediately when tab becomes visible
        void tick();
      }
    };

    void (async () => {
      const initial = loadSeen(address);
      if (!isBaselined(initial)) {
        await runBaseline(address);
      }
      if (cancelled) return;
      void tick();
      intervalId = setInterval(tick, POLL_INTERVAL_MS);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibility);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [stxAddress]);
}

async function runBaseline(address: string): Promise<void> {
  let store = loadSeen(address);
  try {
    const plans = await getUserPlans(address);
    const allTxids: string[] = [];
    for (const plan of plans) {
      try {
        const events = await getPlanExecutionHistory(plan.id);
        for (const ev of events) allTxids.push(ev.txId);
      } catch {
        // skip plan on error
      }
    }
    store = markSeen(store, allTxids);
  } finally {
    store = markBaselined(store);
    saveSeen(address, store);
  }
}

async function runTick(address: string, addNotification: AddNotificationFn): Promise<void> {
  let plans: DCAPlan[];
  try {
    plans = await getUserPlans(address);
  } catch {
    return;
  }
  if (plans.length === 0) return;

  let store = loadSeen(address);
  const newTxids: string[] = [];
  const seenSet = new Set(store.txids);

  for (const plan of plans) {
    let events: PlanExecutionEvent[];
    try {
      events = await getPlanExecutionHistory(plan.id);
    } catch {
      continue;
    }

    const fresh = events
      .filter((e) => !seenSet.has(e.txId) && !newTxids.includes(e.txId))
      .filter((e) => e.status === 'success' || e.status === 'failed')
      .sort((a, b) => a.blockTime - b.blockTime);

    for (const ev of fresh) {
      notifyEvent(addNotification, plan, ev);
      newTxids.push(ev.txId);
    }
  }

  if (newTxids.length > 0) {
    store = markSeen(store, newTxids);
    saveSeen(address, store);
  }
}

function notifyEvent(
  addNotification: AddNotificationFn,
  plan: DCAPlan,
  ev: PlanExecutionEvent
): void {
  const context = {
    planId: String(plan.id),
    txId: ev.txId,
    action: 'executed',
  };
  if (ev.status === 'success') {
    const swapped =
      ev.netSwapped !== undefined
        ? ` — swapped ${microToSTX(ev.netSwapped).toFixed(4)} STX → sBTC`
        : '';
    addNotification(
      `Plan #${plan.id} executed${swapped}`,
      'success',
      'dca',
      undefined, // no auto-dismiss; keep in store
      context
    );
  } else {
    addNotification(
      `Plan #${plan.id} execution failed`,
      'error',
      'dca',
      undefined,
      context
    );
  }
}
