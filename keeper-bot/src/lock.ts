// Distributed lock for the keeper bot. Prevents two overlapping cron runs from
// each broadcasting their own batch tx — the second run would inevitably hit
// a nonce conflict and the loser's STX fee gets burned for nothing.
//
// Why a token check on release:
//   If we just SET/DEL on the same key, a run that overran the TTL would
//   delete a *later* run's lock when it finally cleaned up. The token narrows
//   release to "only delete if I'm still the holder."

import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import { log } from "./logger.js";

const redis = Redis.fromEnv();

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export interface LockHandle {
  key: string;
  token: string;
}

export async function acquireLock(
  key: string,
  ttlSeconds: number
): Promise<LockHandle | null> {
  const token = randomUUID();
  const res = await redis.set(key, token, { nx: true, ex: ttlSeconds });
  if (res !== "OK") {
    return null;
  }
  return { key, token };
}

export async function releaseLock(handle: LockHandle): Promise<void> {
  try {
    await redis.eval(RELEASE_SCRIPT, [handle.key], [handle.token]);
  } catch (err) {
    // Release is best-effort. The TTL will reap the lock if this fails.
    log.warn("Lock release failed (TTL will reap)", { err: String(err) });
  }
}
