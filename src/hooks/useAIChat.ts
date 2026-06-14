// src/hooks/useAIChat.ts
"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { fetchChatStream, type ChatMessage } from "@/lib/ai-chat";

interface UseAIChat {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: boolean;
  send: (text: string) => Promise<void>;
}

// Ephemeral: history lives only in component state and resets on unmount/refresh.
// The full message list is resent to the server each turn (server trims it).
export function useAIChat(address?: string): UseAIChat {
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isStreaming) return;
      setError(false);

      // Cancel any prior in-flight stream.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = { role: "user", content };
      const history = [...messages, userMsg];
      // Optimistically render the user turn + an empty assistant turn to fill.
      setMessages([...history, { role: "assistant", content: "" }]);
      setIsStreaming(true);

      try {
        let acc = "";
        for await (const delta of fetchChatStream({ messages: history, address, locale }, controller.signal)) {
          acc += delta;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
        }
        // An empty reply (e.g. immediate stream close) counts as an error.
        if (!acc.trim()) setError(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(true);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, address, locale]
  );

  return { messages, isStreaming, error, send };
}
