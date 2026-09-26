import { useCallback, useState } from "react";
import { Section, Notice } from "@/components/Shell";
import { ChatMessages, type ChatMessage } from "@/components/ui/chat-messages";
import { post, ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";

/**
 * The conversation lives here and is sent whole with each question. The server keeps nothing,
 * so there is no transcript of what people asked support sitting in a database — and no
 * retention question to answer later.
 */
export default function SupportPage() {
  const greeting = (): ChatMessage => ({
    id: "greeting",
    sender: "assistant",
    content: t("support.greeting"),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([greeting()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (text: string) => {
    const question: ChatMessage = { id: `u-${Date.now()}`, sender: "user", content: text };
    const next = [...messages, question];

    setMessages(next);
    setPending(true);
    setError(null);

    try {
      const reply = await post<{ content: string; fromModel: boolean }>("/api/assistant", {
        // The greeting is ours, not the visitor's — sending it back would have the assistant
        // answering its own hello.
        messages: next
          .filter((m) => m.id !== "greeting")
          .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content })),
      });

      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, sender: "assistant", content: reply.content, fromModel: reply.fromModel },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("support.failed"));
    } finally {
      setPending(false);
    }
  }, [messages]);

  return (
    <Section title={t("support.title")} lede={t("support.lede")}>
      {error ? <div className="mb-4"><Notice tone="error">{error}</Notice></div> : null}

      <ChatMessages
        className="h-[560px] w-full max-w-2xl"
        messages={messages}
        pending={pending}
        onSend={send}
        onClear={() => { setMessages([greeting()]); setError(null); }}
      />
    </Section>
  );
}
