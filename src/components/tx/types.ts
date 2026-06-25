import type { NotificationCategory, NotificationContext } from "@/types/notifications";

export type TxPhase = "form" | "submitting" | "submitted" | "confirmed" | "failed";

export type NextAction = { label: string; href: string };

/** Wraps a domain submit fn — calls onFinish with the txId, or onCancel on rejection. */
export type TxDriver = (
  onFinish: (r: { txId: string }) => void,
  onCancel: () => void,
) => void;

export type TxState = { phase: TxPhase; txId: string | null };

export type TxAction =
  | { type: "SUBMIT" }
  | { type: "FINISH"; txId: string }
  | { type: "RESOLVE"; status: "success" | "failed" }
  | { type: "CANCEL" }
  | { type: "RESET" };

export interface UseTxFlowOptions {
  driver: TxDriver;
  label: string;                 // forwarded to trackTx notification ("Supply", "Stake", …)
  category: NotificationCategory;
  context?: NotificationContext;
  address?: string | null;
  submittedMessage: string;      // toast shown the moment the wallet returns a txId
  addNotification: (
    message: string,
    type: "success" | "error" | "warning" | "info",
    category: NotificationCategory,
    duration?: number,
    context?: NotificationContext,
  ) => void;
}
