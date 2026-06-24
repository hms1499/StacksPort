import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SendResult } from "web-push";

vi.mock("web-push");
vi.mock("../push-redis");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_SUBJECT = "mailto:a@b.c";
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

import webpush from "web-push";
import { getSub } from "../push-redis";
import { sendPushToAddress } from "./push-send";

describe("sendPushToAddress", () => {
  it("sends when a subscription exists", async () => {
    vi.mocked(getSub).mockResolvedValue({
      subscription: { endpoint: "e", keys: { auth: "a", p256dh: "p" } },
      alerts: [],
      updatedAt: Date.now(),
    });
    vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: "", headers: {} } as SendResult);
    const ok = await sendPushToAddress("SP1", { title: "t", body: "b" });
    expect(ok).toBe(true);
    expect(vi.mocked(webpush.sendNotification)).toHaveBeenCalledOnce();
  });
  it("no-ops when no subscription", async () => {
    vi.mocked(getSub).mockResolvedValue(null);
    const ok = await sendPushToAddress("SP1", { title: "t", body: "b" });
    expect(ok).toBe(false);
    expect(vi.mocked(webpush.sendNotification)).not.toHaveBeenCalled();
  });
});
