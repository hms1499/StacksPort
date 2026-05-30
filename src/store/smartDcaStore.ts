import { create } from "zustand";
import type { SmartDcaConfigView } from "@/lib/smart-dca-redis";

interface SmartDcaState {
  configs: Record<number, SmartDcaConfigView>; // keyed by planId
  setAll: (list: SmartDcaConfigView[]) => void;
  upsert: (cfg: SmartDcaConfigView) => void;
  remove: (planId: number) => void;
}

export const useSmartDcaStore = create<SmartDcaState>((set) => ({
  configs: {},
  setAll: (list) =>
    set({ configs: Object.fromEntries(list.map((c) => [c.planId, c])) }),
  upsert: (cfg) => set((s) => ({ configs: { ...s.configs, [cfg.planId]: cfg } })),
  remove: (planId) =>
    set((s) => {
      const next = { ...s.configs };
      delete next[planId];
      return { configs: next };
    }),
}));
