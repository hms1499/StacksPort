import { loadConfig } from "./config.js";
import { StacksClient } from "./stacks-client.js";
import { BatchExecutor, chunkArray } from "./batch-executor.js";
import { readAllSubs } from "./redis-store.js";
import { sendDcaExecutionNotifications } from "./dca-push.js";
import { notifyBatchExecuted } from "./telegram-notify.js";
import { log } from "./logger.js";

const LOW_BALANCE_WARN_USTX = 100_000; // 0.1 STX
const MAX_BATCH_SIZE = 50;

async function main(): Promise<void> {
  const config = await loadConfig();

  log.info("Keeper bot starting", {
    batchExecutorContract: config.batchExecutorContract,
    keeperAddress:         config.keeperAddress,
  });

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

  // Scan both vaults for executable plans
  const plans = await client.getExecutablePlansForBothVaults();
  log.info("Plans ready to execute", { count: plans.length, plans });

  if (plans.length === 0) {
    log.info("Nothing to execute, exiting");
    process.exit(0);
  }

  // Chunk into batches of ≤50 (Clarity list limit)
  const chunks = chunkArray(plans, MAX_BATCH_SIZE);
  log.info("Executing batches", { totalPlans: plans.length, chunks: chunks.length });

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

      // Gửi Web Push đến wallet owners của các plans vừa được execute
      sendDcaExecutionNotifications(chunk, result.txid, allSubs).catch((err) => {
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

  log.info("Run complete", { totalPlans: plans.length, chunks: chunks.length });
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err: unknown) => {
  log.error("Fatal error", { err: String(err) });
  process.exit(1);
});
