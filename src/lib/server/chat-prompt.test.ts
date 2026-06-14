// src/lib/server/chat-prompt.test.ts
import { describe, it, expect } from "vitest";
import { trimHistory, validateChatRequest, buildMessages, SYSTEM_PROMPT } from "./chat-prompt";

describe("trimHistory", () => {
  it("keeps only the most recent N messages", () => {
    const msgs = Array.from({ length: 14 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    const out = trimHistory(msgs, 10);
    expect(out).toHaveLength(10);
    expect(out[0].content).toBe("m4");
    expect(out[9].content).toBe("m13");
  });

  it("drops malformed entries", () => {
    const out = trimHistory(
      [
        { role: "user", content: "ok" },
        { role: "system" as unknown as "user", content: "bad role" },
        { role: "assistant", content: "" },
        { role: "assistant", content: "fine" },
      ] as never,
      10
    );
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.content)).toEqual(["ok", "fine"]);
  });
});

describe("validateChatRequest", () => {
  it("accepts a valid body and trims the address", () => {
    const out = validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      address: "  SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR  ",
    });
    expect(out.messages).toHaveLength(1);
    expect(out.address).toBe("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR");
  });

  it("accepts a body with no address (no wallet)", () => {
    const out = validateChatRequest({ messages: [{ role: "user", content: "hi" }] });
    expect(out.address).toBeUndefined();
  });

  it("throws when there are no usable messages", () => {
    expect(() => validateChatRequest({ messages: [] })).toThrow();
    expect(() => validateChatRequest({ messages: [{ role: "user", content: "" }] })).toThrow();
  });

  it("drops an invalid address instead of throwing", () => {
    const out = validateChatRequest({ messages: [{ role: "user", content: "hi" }], address: "not-an-address" });
    expect(out.address).toBeUndefined();
  });

  it("normalizes the locale (default en, unknown → en)", () => {
    expect(validateChatRequest({ messages: [{ role: "user", content: "hi" }], locale: "zh" }).locale).toBe("zh");
    expect(validateChatRequest({ messages: [{ role: "user", content: "hi" }] }).locale).toBe("en");
    expect(validateChatRequest({ messages: [{ role: "user", content: "hi" }], locale: "fr" }).locale).toBe("en");
  });
});

describe("buildMessages", () => {
  it("puts the system+context first, then the trimmed history in order", () => {
    const out = buildMessages("CONTEXT-BLOCK", [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
    expect(out[0].role).toBe("system");
    expect(out[0].content).toContain(SYSTEM_PROMPT);
    expect(out[0].content).toContain("CONTEXT-BLOCK");
    expect(out.slice(1).map((m) => m.content)).toEqual(["q1", "a1", "q2"]);
  });

  it("appends a Chinese language directive to the system message for zh", () => {
    const en = buildMessages("CTX", [{ role: "user", content: "q" }]);
    const zh = buildMessages("CTX", [{ role: "user", content: "q" }], "zh");
    expect(en[0].content).not.toContain("Simplified Chinese");
    expect(zh[0].content).toContain("Simplified Chinese");
  });
});
