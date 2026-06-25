import { describe, it, expect } from "vitest";
import { txReducer } from "./useTxFlow";

const form = { phase: "form", txId: null } as const;

describe("txReducer", () => {
  it("SUBMIT moves form → submitting", () => {
    expect(txReducer(form, { type: "SUBMIT" })).toEqual({ phase: "submitting", txId: null });
  });
  it("FINISH moves submitting → submitted with txId", () => {
    const s = txReducer(form, { type: "SUBMIT" });
    expect(txReducer(s, { type: "FINISH", txId: "0x1" })).toEqual({ phase: "submitted", txId: "0x1" });
  });
  it("RESOLVE success → confirmed, keeps txId", () => {
    const s = { phase: "submitted", txId: "0x1" } as const;
    expect(txReducer(s, { type: "RESOLVE", status: "success" })).toEqual({ phase: "confirmed", txId: "0x1" });
  });
  it("RESOLVE failed → failed, keeps txId", () => {
    const s = { phase: "submitted", txId: "0x1" } as const;
    expect(txReducer(s, { type: "RESOLVE", status: "failed" })).toEqual({ phase: "failed", txId: "0x1" });
  });
  it("CANCEL returns to form", () => {
    const s = txReducer(form, { type: "SUBMIT" });
    expect(txReducer(s, { type: "CANCEL" })).toEqual({ phase: "form", txId: null });
  });
  it("RESET returns to form from any state", () => {
    const s = { phase: "confirmed", txId: "0x1" } as const;
    expect(txReducer(s, { type: "RESET" })).toEqual({ phase: "form", txId: null });
  });
});
