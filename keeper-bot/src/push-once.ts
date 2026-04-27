// keeper-bot/src/push-once.ts
import 'dotenv/config';
import { runOnce } from './price-push.js';

(async () => {
  console.log(JSON.stringify({ msg: 'push-once starting' }));
  await runOnce();
  console.log(JSON.stringify({ msg: 'push-once done' }));
  process.exit(0);
})().catch((err) => {
  console.error(JSON.stringify({ msg: 'push-once fatal', err: String(err) }));
  process.exit(1);
});
