import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Send, RotateCcw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/**
 * Chat surface, adapted from the 21st.dev chat-messages component.
 *
 * What changed, and why:
 *
 *  - `"use client"` removed — a Next.js marker with no meaning in a Vite build.
 *  - `framer-motion` swapped for `motion/react`. It is the same library under its current
 *    name, already installed here; adding framer-motion would have shipped two copies of it.
 *  - The demo's auto-play, scripted transcript and fake assistant reply are gone. They exist
 *    to make a screenshot look alive; here the replies are real, and a component that invents
 *    a plausible-sounding answer on a timer is the opposite of what a support box should do.
 *  - Indigo/violet gradients and zinc surfaces replaced with the site's tokens.
 */

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  /** False when the answer came from the written FAQ rather than a model. */
  fromModel?: boolean;
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-surface-raised px-4 py-3"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-ink-mute"
          animate={{ opacity: [0.4, 1, 0.4], y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </motion.div>
  );
}

/** Minimal markdown: **bold** only. The answers use it for page names and nothing else, so a
 *  full parser would be a dependency bought for one asterisk pair. */
function renderContent(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-accent">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
        {!isUser ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-dim">
            <Eye className="size-4 text-surface" aria-hidden />
          </div>
        ) : null}

        <div
          className={cn(
            "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-md bg-accent text-surface"
              : "rounded-tl-md border border-line bg-surface-raised text-ink",
          )}
        >
          {renderContent(message.content)}
        </div>
      </div>
    </motion.div>
  );
}

export function ChatMessages({
  messages,
  pending,
  onSend,
  onClear,
  className,
}: {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const list = scrollRef.current;
    if (!list) return;
    if (typeof list.scrollTo === "function") list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    else list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, pending, scrollToBottom]);

  function send() {
    const text = value.trim();
    if (!text || pending) return;
    onSend(text);
    setValue("");
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
            <Eye className="size-4 text-surface" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-medium text-ink">WatchingYou AI</h3>
            <p className="text-xs text-ink-mute">{t("support.lede")}</p>
          </div>
        </div>

        <button
          onClick={onClear}
          aria-label={t("support.clear")}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-mute transition-colors hover:text-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t("support.clear")}
        </button>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-label="WatchingYou AI"
        aria-live="polite"
        className="flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        <AnimatePresence>{pending ? <TypingIndicator /> : null}</AnimatePresence>
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-4 py-2 focus-within:border-accent">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("support.placeholder")}
            aria-label={t("support.placeholder")}
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-mute/70"
          />
          <button
            onClick={send}
            disabled={pending || !value.trim()}
            aria-label={t("support.send")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              value.trim() && !pending ? "bg-accent text-surface hover:bg-accent-bright" : "bg-line text-ink-mute",
            )}
          >
            <Send className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatMessages;
