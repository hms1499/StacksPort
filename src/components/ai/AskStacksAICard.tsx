// src/components/ai/AskStacksAICard.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";

export default function AskStacksAICard({ address }: { address?: string }) {
  const t = useTranslations("ai.chat");
  const { messages, isStreaming, error, send } = useAIChat(address);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the stream fills.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || isStreaming) return;
    send(input);
    setInput("");
  };

  const suggestions = t.raw("suggestions") as string[];

  return (
    <div className="glass-card rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} style={{ color: "var(--accent-text)" }} />
        <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t("title")}</h3>
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>{t("disclaimer")}</p>

      <div ref={scrollRef} className="flex-1 max-h-80 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            {!address && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("connectHint")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { if (!isStreaming) send(s); }}
                  className="text-xs px-3 py-1.5 rounded-full glass-card shadow-sm transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
              style={
                m.role === "user"
                  ? { backgroundColor: "var(--accent)", color: "#fff" }
                  : { backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }
              }
            >
              {m.content || (isStreaming && i === messages.length - 1 ? <Loader2 size={14} className="animate-spin" /> : "")}
            </div>
          </div>
        ))}

        {error && (
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{t("error")}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t("placeholder")}
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-60"
          style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
        />
        <button
          onClick={submit}
          disabled={isStreaming || !input.trim()}
          className="p-2 rounded-xl text-white disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: "var(--accent)" }}
          aria-label={t("send")}
        >
          {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
