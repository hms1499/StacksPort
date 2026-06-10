import { loadConfig } from "./config.js";
import { StacksClient } from "./stacks-client.js";
import { BatchExecutor, chunkArray } from "./batch-executor.js";
import { readAllSubs } from "./redis-store.js";
import { sendDcaExecutionNotifications } from "./dca-push.js";
import { notifyBatchExecuted } from "./telegram-notify.js";
import { acquireLock, releaseLock } from "./lock.js";
import { recordBroadcast, markRun } from "./failure-tracker.js";
import { reconcileRecentBatches } from "./reconcile.js";
import { log } from "./logger.js";
import { readAllConfigs, readAllDefers, writeDefers } from "./smart-dca-store.js";
import { fetchSatsPerStxSignal } from "./smart-dca-signal.js";
import { decideBatch } from "./smart-dca.js";

const LOW_BALANCE_WARN_USTX = 100_000; // 0.1 STX
const MAX_BATCH_SIZE = 50;

// Lock window covers: plan scan (~5s) + worst-case 3 retries × 10s backoff +
// broadcast + notifications. 5 min is generous; if the run actually exceeds
// it the next cron will take over (safer than holding forever).
const LOCK_KEY = "keeper-bot:run-lock";
const LOCK_TTL_SECONDS = 300;

async function main(): Promise<void> {
  const lock = await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
  if (!lock) {
    log.info("Another keeper run is in progress — exiting cleanly");
    process.exit(0);
  }

  let code = 0;
  try {
    code = await runOnce();
  } finally {
    await releaseLock(lock);
  }
  process.exit(code);
}

async function runOnce(): Promise<number> {
  const config = await loadConfig();

  log.info("Keeper bot starting", {
    batchExecutorContract: config.batchExecutorContract,
    keeperAddress:         config.keeperAddress,
  });

  // Settle any broadcasts from previous runs before scanning new work. If
  // chronic aborts are happening, the operator gets paged before we burn
  // more fees on another doomed run.
  try {
    await reconcileRecentBatches(config.hiroApiUrl);
  } catch (err) {
    log.warn("reconcile failed (non-fatal)", { err: String(err) });
  }

  const client   = new StacksClient(config);
  const executor = new BatchExecutor(config);

  // Check keeper wallet balance
  const balance = await client.getKeeperBalance();
  log.info("Keeper balance", {
    balanceUstx: balance,
    balanceSTX:  (balance / 1_000_000).toFixed(6),
  });

  if (balance < LOW_BALANCE_WARN_USTX) {
    log.warn("Keeper balance is low — top up needed", {
      balanceSTX: (balance / 1_000_000).toFixed(6),
    });
  }

  // Scan all vaults for executable plans
  const plans = await client.getExecutablePlansForAllVaults();
  log.info("Plans ready to execute", { count: plans.length, plans });

  if (plans.length === 0) {
    log.info("Nothing to execute, exiting");
    await markRun({ finishedAt: Date.now(), planCount: 0, chunkCount: 0, exitCode: 0 }).catch(() => {});
    return 0;
  }

  // ── Smart DCA: gate due vault-0 plans on the dip condition ──────────────
  // Fail-open: any error here leaves `executablePlans` = all due plans.
  let executablePlans = plans;
  let dipPlanIds: Set<number> | undefined;
  try {
    const configs = await readAllConfigs();
    if (configs.size > 0) {
      const maxDays = Math.max(
        7,
        ...[...configs.values()].map((c) => c.windowDays)
      );
      const [defers, signal] = await Promise.all([
        readAllDefers(),
        fetchSatsPerStxSignal(maxDays),
      ]);
      const { toExecute, deferWrites, reasons } = decideBatch({
        plans,
        configs,
        deferByPlan: defers,
        signal,
      });
      await writeDefers(deferWrites).catch((err) =>
        log.warn("smart-dca writeDefers failed (non-fatal)", { err: String(err) })
      );
      dipPlanIds = new Set(
        [...reasons].filter(([, r]) => r === "dip-hit").map(([id]) => id)
      );
      const skipped = plans.length - toExecute.length;
      log.info("Smart DCA gating applied", {
        configured: configs.size,
        skipped,
        signal: signal ? signal.current.toFixed(2) : "fail-open",
      });
      executablePlans = toExecute;
    }
  } catch (err) {
    log.warn("smart-dca gating failed (non-fatal, failing open)", { err: String(err) });
  }

  if (executablePlans.length === 0) {
    log.info("Nothing to execute after Smart DCA gating, exiting");
    await markRun({ finishedAt: Date.now(), planCount: 0, chunkCount: 0, exitCode: 0 }).catch(() => {});
    return 0;
  }

  // Chunk into batches of ≤50 (Clarity list limit)
  const chunks = chunkArray(executablePlans, MAX_BATCH_SIZE);
  log.info("Executing batches", { totalPlans: executablePlans.length, chunks: chunks.length });

  // Đọc push subscriptions một lần trước khi execute để tránh gọi Redis nhiều lần.
  // Nếu Redis không available thì push notification sẽ bị skip nhưng execution vẫn tiếp tục.
  let allSubs: Awaited<ReturnType<typeof readAllSubs>> = {};
  try {
    allSubs = await readAllSubs();
  } catch (err) {
    log.warn("Could not read push subscriptions — execution notifications will be skipped", {
      err: String(err),
    });
  }

  let anyFailed = false;
  // Nonce management only needed when >50 plans (multiple chunks)
  let nonce: number | undefined = chunks.length > 1
    ? await client.getAccountNonce(config.keeperAddress)
    : undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    log.info(`Sending batch ${i + 1}/${chunks.length}`, { planCount: chunk.length });

    const result = await executor.executeBatchWithRetry(chunk, nonce);

    if (result) {
      log.info(`Batch ${i + 1} broadcast`, { txid: result.txid, planCount: chunk.length });
      if (nonce !== undefined) nonce++;

      // Record for the next run's reconcile pass. Fire-and-forget — a Redis
      // hiccup here shouldn't fail the broadcast we just did.
      recordBroadcast(result.txid, chunk.map((p) => p.planId)).catch((err) =>
        log.warn("failure-tracker record failed (non-fatal)", { err: String(err) })
      );

      // Gửi Web Push đến wallet owners của các plans vừa được execute
      sendDcaExecutionNotifications(chunk, result.txid, allSubs, dipPlanIds).catch((err) => {
        log.warn("dca-push failed (non-fatal)", { err: String(err) });
      });

      // Gửi Telegram alert đến operator (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID phải set trong .env)
      notifyBatchExecuted(chunk, result.txid).catch((err) => {
        log.warn("telegram notify failed (non-fatal)", { err: String(err) });
      });
    } else {
      log.error(`Batch ${i + 1} failed after all retries`, {
        planIds: chunk.map((p) => p.planId),
      });
      anyFailed = true;
    }
  }

  log.info("Run complete", { totalPlans: executablePlans.length, chunks: chunks.length });
  const exitCode = anyFailed ? 1 : 0;
  await markRun({
    finishedAt: Date.now(),
    planCount: executablePlans.length,
    chunkCount: chunks.length,
    exitCode,
  }).catch((err) => log.warn("markRun failed (non-fatal)", { err: String(err) }));
  return exitCode;
}

main().catch((err: unknown) => {
  log.error("Fatal error", { err: String(err) });
  process.exit(1);
});
