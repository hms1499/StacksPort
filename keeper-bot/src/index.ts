import { loadConfig } from "./config";
import { StacksClient, sleep } from "./stacks-client";
import { NonceManager } from "./nonce-manager";
import { Executor } from "./executor";
import { log } from "./logger";

const LOW_BALANCE_WARN_USTX = 100_000; // 0.1 STX

async function main(): Promise<void> {
  const config = await loadConfig();

  log.info("Keeper bot starting", {
    contractAddress: config.contractAddress,
    contractName:    config.contractName,
    keeperAddress:   config.keeperAddress,
  });

  const client       = new StacksClient(config);
  const nonceManager = new NonceManager(client, config);
  const executor     = new Executor(config);

  // Check keeper wallet balance
  const balance = await client.getKeeperBalance();
  log.info("Keeper balance", {
    balanceUstx: balance,
    balanceSTX: (balance / 1_000_000).toFixed(6),
  });

  if (balance < LOW_BALANCE_WARN_USTX) {
    log.warn("Keeper balance is low — top up needed", { balanceSTX: (balance / 1_000_000).toFixed(6) });
  }

  // Scan all plans
  const totalPlans = await client.getTotalPlans();
  log.info("Scanning plans", { totalPlans });

  if (totalPlans === 0) {
    log.info("No plans found, exiting");
    process.exit(0);
  }

  const executableIds = await client.getExecutablePlanIds(totalPlans);
  log.info("Plans ready to execute", { count: executableIds.length, ids: executableIds });

  if (executableIds.length === 0) {
    log.info("Nothing to execute, exiting");
    process.exit(0);
  }

  // Cooldown after scan to let rate limit window reset
  await sleep(15000);

  // Execute each plan sequentially
  let executed = 0;
  let failed   = 0;

  for (const planId of executableIds) {
    const result = await executor.executePlanWithRetry(
      planId,
      () => nonceManager.getNextNonce(),
      () => nonceManager.confirmTx(),
      () => nonceManager.reset()
    );

    if (result) {
      log.info("DCA executed", { planId, txid: result.txid });
      executed++;
    } else {
      log.error("DCA failed after retries", { planId });
      failed++;
    }

    await sleep(4000);
  }

  log.info("Run complete", { executed, failed, total: executableIds.length });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  log.error("Fatal error", { err: String(err) });
  process.exit(1);
});
