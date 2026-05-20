// src/lib/tx-tracker.ts
// Poll Hiro API cho transaction status sau khi user submit.
// Gọi addNotification khi tx confirm hoặc fail — đóng gap "submitted nhưng không biết kết quả".

import type { NotificationCategory, NotificationContext } from '@/types/notifications';

const HIRO_API = 'https://api.hiro.so';
const POLL_INTERVAL_MS = 10_000;  // 10s — Stacks block time ~10s
const MAX_ATTEMPTS     = 36;       // 6 phút tối đa

type TxStatus = 'pending' | 'success' | 'abort_by_response' | 'abort_by_post_condition' | 'not_found';

interface TxApiResponse {
  tx_status: TxStatus;
}

async function fetchTxStatus(txId: string): Promise<TxStatus> {
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/tx/${txId}`);
    if (res.status === 404) return 'not_found';
    if (!res.ok) return 'pending'; // network hiccup — retry
    const data = await res.json() as TxApiResponse;
    return data.tx_status ?? 'pending';
  } catch {
    return 'pending';
  }
}

export interface TrackTxOptions {
  txId: string;
  // Label dùng trong notification: "Swap", "Transfer", "DCA plan created", v.v.
  label: string;
  category: NotificationCategory;
  context?: NotificationContext;
  addNotification: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    category: NotificationCategory,
    duration?: number,
    context?: NotificationContext,
  ) => void;
}

// Fire-and-forget — gọi sau openContractCall/openSTXTransfer onFinish.
// Không block UI, không throw.
export function trackTx({ txId, label, category, context, addNotification }: TrackTxOptions): void {
  let attempts = 0;

  const poll = async () => {
    attempts++;
    const status = await fetchTxStatus(txId);

    if (status === 'pending' || status === 'not_found') {
      // not_found = mempool chưa index xong — tiếp tục retry
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
      // Hết thời gian: im lặng, không spam error (user đã thấy "submitted" rồi)
      return;
    }

    if (status === 'success') {
      addNotification(
        `${label} confirmed on-chain.`,
        'success',
        category,
        undefined, // keep in drawer
        { ...context, txId, action: 'confirmed' },
      );
    } else {
      // abort_by_response hoặc abort_by_post_condition
      addNotification(
        `${label} failed on-chain. Check Explorer for details.`,
        'error',
        category,
        undefined,
        { ...context, txId, action: 'failed' },
      );
    }
  };

  // Delay đầu tiên 15s — tx mới submit chắc chắn chưa confirmed
  setTimeout(poll, 15_000);
}
