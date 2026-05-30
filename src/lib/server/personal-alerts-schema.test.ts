// src/lib/server/personal-alerts-schema.test.ts
import { describe, it, expect } from "vitest";
import { parsePersonalAlerts } from "./personal-alerts-schema";

const valid = {
  alerts: [
    { title: "DCA low", description: "Plan 3 has ~2 days left.", type: "warning", priority: "high" },
    { title: "Up 30%", description: "ALEX is up.", type: "opportunity", priority: "low" },
  ],
};

describe("parsePersonalAlerts", () => {
  it("accepts a valid object", () => {
    expect(parsePersonalAlerts(valid).alerts).toHaveLength(2);
  });

  it("drops alerts with an invalid enum instead of failing the parse", () => {
    const out = parsePersonalAlerts({
      alerts: [
        { title: "ok", description: "d", type: "warning", priority: "high" },
        { title: "bad", description: "d", type: "explosive", priority: "high" },
      ],
    });
    expect(out.alerts).toHaveLength(1);
    expect(out.alerts[0].title).toBe("ok");
  });

  it("defaults alerts to [] when absent", () => {
    expect(parsePersonalAlerts({}).alerts).toEqual([]);
  });

  it("throws when alerts is not an array-like value", () => {
    expect(() => parsePersonalAlerts({ alerts: "nope" })).toThrow();
  });
});
