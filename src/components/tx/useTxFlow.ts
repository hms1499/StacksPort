"use client";

import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { trackTx } from "@/lib/tx-tracker";
import type { TxState, TxAction, UseTxFlowOptions } from "./types";

export function txReducer(state: TxState, action: TxAction): TxState {
  switch (action.type) {
    case "SUBMIT":
      return { phase: "submitting", txId: null };
    case "FINISH":
      return { phase: "submitted", txId: action.txId };
    case "RESOLVE":
      return { phase: action.status === "success" ? "confirmed" : "failed", txId: state.txId };
    case "CANCEL":
    case "RESET":
      return { phase: "form", txId: null };
    default:
      return state;
  }
}

export function useTxFlow(opts: UseTxFlowOptions) {
  const [state, dispatch] = useReducer(txReducer, { phase: "form", txId: null });

  // Keep a stable `submit` identity while always reading the latest opts.
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const submit = useCallback(() => {
    const opts = optsRef.current;
    dispatch({ type: "SUBMIT" });
    opts.driver(
      ({ txId }) => {
        dispatch({ type: "FINISH", txId });
        opts.addNotification(opts.submittedMessage, "info", opts.category, 5000, {
          ...opts.context, txId, action: "created",
        });
        trackTx({
          txId,
          label: opts.label,
          category: opts.category,
          context: opts.context,
          address: opts.address,
          addNotification: opts.addNotification,
          onResolved: (status) => dispatch({ type: "RESOLVE", status }),
        });
      },
      () => dispatch({ type: "CANCEL" }),
    );
  }, []);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { phase: state.phase, txId: state.txId, submit, reset };
}
