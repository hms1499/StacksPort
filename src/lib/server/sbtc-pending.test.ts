// src/lib/server/sbtc-pending.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, Record<string, string>>();
vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      hset: async (k: string, v: Record<string, string>) => {
        store.set(k, { ...(store.get(k) ?? {}), ...v });
      },
      hgetall: async (k: string) => store.get(k) ?? null,
      hdel: async (k: string, f: string) => { delete store.get(k)?.[f]; },
      expire: async () => 1,
      keys: async (pat: string) =>
        [...store.keys()].filter((k) => k.startsWith(pat.replace("*", ""))),
    }),
  },
}));

beforeEach(() => { store.clear(); process.env.UPSTASH_REDIS_REST_URL = "x"; process.env.UPSTASH_REDIS_REST_TOKEN = "y"; });

import { addPending, listForAddress, updateStatus, listAllAddresses, removeDeposit } from "./sbtc-pending";

const base = {
  txid: "abc", stacksAddress: "SP1", amountSats: 100000,
  status: "broadcast" as const, createdAt: 1, depositScript: "ds", reclaimScript: "rs",
};

describe("sbtc-pending", () => {
  it("adds and lists by address", async () => {
    await addPending(base);
    expect(await listForAddress("SP1")).toEqual([base]);
  });
  it("updates status in place", async () => {
    await addPending(base);
    await updateStatus("SP1", "abc", "notified");
    expect((await listForAddress("SP1"))[0].status).toBe("notified");
  });
  it("lists all addresses with pending deposits", async () => {
    await addPending(base);
    await addPending({ ...base, stacksAddress: "SP2", txid: "def" });
    expect((await listAllAddresses()).sort()).toEqual(["SP1", "SP2"]);
  });
  it("removes a deposit", async () => {
    await addPending(base);
    await removeDeposit("SP1", "abc");
    expect(await listForAddress("SP1")).toEqual([]);
  });
});
