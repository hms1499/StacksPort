// keeper-bot/src/telegram-notify.ts
// Gửi Telegram message đến operator sau mỗi batch DCA execution.
// Dùng cùng bot token với Next.js app — chỉ cần thêm TELEGRAM_BOT_TOKEN
// và TELEGRAM_CHAT_ID vào keeper-bot/.env.

import { log } from './logger.js';
import type { BatchPlan } from './batch-executor.js';
import type { BatchEntry } from './failure-tracker.js';

const TELEGRAM_API = 'https://api.telegram.org';
const HIRO_EXPLORER = 'https://explorer.hiro.so';

async function sendMessage(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
}

export async function notifyBatchExecuted(
  plans: BatchPlan[],
  txid: string,
): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Telegram credentials optional — nếu không set thì skip silently
  if (!token || !chatId) return;

  const stxPlans  = plans.filter((p) => p.vaultType === 0);
  const sbtcPlans = plans.filter((p) => p.vaultType === 1);

  const lines: string[] = ['🤖 *DCA Batch Executed*', ''];

  if (stxPlans.length > 0) {
    lines.push(`STX→sBTC: ${stxPlans.length} plan(s) — IDs: ${stxPlans.map((p) => `#${p.planId}`).join(', ')}`);
  }
  if (sbtcPlans.length > 0) {
    lines.push(`sBTC→USDCx: ${sbtcPlans.length} plan(s) — IDs: ${sbtcPlans.map((p) => `#${p.planId}`).join(', ')}`);
  }

  lines.push('');
  lines.push(`[View tx on Explorer](${HIRO_EXPLORER}/txid/${txid}?chain=mainnet)`);

  try {
    await sendMessage(token, chatId, lines.join('\n'));
    log.info('telegram: batch notification sent', { plans: plans.length, txid });
  } catch (err) {
    // Non-fatal — execution đã xong, chỉ log warn
    log.warn('telegram: notification failed', { err: String(err) });
  }
}

export async function notifyBatchAborted(entry: BatchEntry): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const lines = [
    '🚨 *DCA Batch Aborted On-Chain*',
    '',
    `Reason: \`${entry.abortReason ?? 'unknown'}\``,
    `Plans affected: ${entry.planIds.length} — IDs: ${entry.planIds.map((id) => `#${id}`).join(', ')}`,
    '',
    `[View tx on Explorer](${HIRO_EXPLORER}/txid/${entry.txid}?chain=mainnet)`,
  ];

  await sendMessage(token, chatId, lines.join('\n'));
}

export async function notifyConsecutiveAborts(count: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const lines = [
    '🔥 *Keeper bot needs attention*',
    '',
    `${count} consecutive batch broadcasts have aborted on-chain.`,
    'Likely root causes: contract trap, post-condition mismatch, keeper balance too low for fees, or a misconfigured swap router.',
    '',
    'Action: inspect the latest aborted tx on Explorer and pause cron if needed.',
  ];

  await sendMessage(token, chatId, lines.join('\n'));
}
