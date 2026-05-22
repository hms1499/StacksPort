// Sliding-window circuit breaker for Hiro RPC calls.
//
// Why: when Hiro is degraded, the scan loop in getExecutablePlanIds retries
// each plan through 5 rate-limit attempts × 5s backoff before giving up. With
// 100 plans, that's ~40 minutes of doomed scanning before the cron run dies.
// The breaker fails fast: after 5 fails in the last 10 calls, subsequent
// calls reject immediately, the run aborts within seconds, and the next cron
// gets a fresh try.

const WINDOW_SIZE = 10;
const FAIL_THRESHOLD = 5;
const OPEN_DURATION_MS = 60_000;

type Outcome = "ok" | "fail";

interface State {
  recent: Outcome[];
  openedAt: number | null;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`circuit '${name}' is open`);
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private state: State = { recent: [], openedAt: null };

  constructor(private readonly name: string) {}

  /**
   * Wraps an async call. Throws CircuitOpenError if the breaker is open,
   * otherwise records the outcome.
   */
  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError(this.name);
    }
    try {
      const result = await fn();
      this.record("ok");
      return result;
    } catch (err) {
      this.record("fail");
      throw err;
    }
  }

  isOpen(): boolean {
    if (this.state.openedAt === null) return false;
    if (Date.now() - this.state.openedAt >= OPEN_DURATION_MS) {
      // half-open: clear the window so the next call probes fresh
      this.state = { recent: [], openedAt: null };
      return false;
    }
    return true;
  }

  private record(outcome: Outcome): void {
    this.state.recent.push(outcome);
    if (this.state.recent.length > WINDOW_SIZE) {
      this.state.recent.shift();
    }
    if (this.state.recent.length === WINDOW_SIZE) {
      const fails = this.state.recent.filter((o) => o === "fail").length;
      if (fails >= FAIL_THRESHOLD) {
        this.state.openedAt = Date.now();
      }
    }
  }

  snapshot(): { recent: number; fails: number; open: boolean } {
    const fails = this.state.recent.filter((o) => o === "fail").length;
    return { recent: this.state.recent.length, fails, open: this.isOpen() };
  }
}
