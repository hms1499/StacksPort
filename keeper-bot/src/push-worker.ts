// keeper-bot/src/push-worker.ts
import 'dotenv/config';
import { startPricePushLoop } from './price-push.js';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INTERVAL_MS = parseInt(process.env.PUSH_CHECK_INTERVAL_MS ?? String(DEFAULT_INTERVAL_MS), 10);

console.log(JSON.stringify({
  msg: 'push-worker starting',
  intervalMs: INTERVAL_MS,
}));

startPricePushLoop(INTERVAL_MS);
