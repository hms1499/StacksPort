import 'dotenv/config';
import { startPricePushLoop } from './price-push.js';

const INTERVAL_MS = parseInt(process.env.PUSH_CHECK_INTERVAL_MS ?? '10000', 10);

console.log(`[push-worker] Starting price push loop (interval: ${INTERVAL_MS}ms)`);
startPricePushLoop(INTERVAL_MS);
