"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentMember } from "@/lib/use-current-member";
import { Send, X, Minimize2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatBubble() {
  const router = useRouter();
  const memberId = useCurrentMember();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          memberId,
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.message }]);

      if (data.navigateTo) {
        router.push(data.navigateTo);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Désolé, une erreur est survenue. Réessaie." }]);
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9998,
            width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
            boxShadow: "0 4px 20px rgba(10, 61, 95, 0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          title="Assistant IA"
        >
          🧙‍♂️
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9998,
          width: 420, height: 560, borderRadius: 16,
          background: "white", boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          border: "1px solid #dce8f0",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🧙‍♂️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Assistant LCA</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Ton coach & assistant CRM</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4 }}>
                <Minimize2 className="h-4 w-4" />
              </button>
              <button onClick={() => { setOpen(false); setMessages([]); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4 }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🧙‍♂️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>Salut ! Je suis ton assistant.</div>
                <div style={{ fontSize: 13, color: "#8399a9", lineHeight: 1.5 }}>
                  Je peux t'aider à naviguer le CRM, créer des contacts, des RDV, chercher des infos...
                  et aussi te coacher au quotidien ! Pose-moi ta question.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 16 }}>
                  {["Combien de leads ?", "Crée un contact", "Où voir le pipeline ?", "Conseils pour closer"].map(q => (
                    <button key={q} onClick={() => { setInput(q); }}
                      style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, border: "1px solid #dce8f0", background: "#f8fbfd", color: "#1a6b9c", cursor: "pointer", fontWeight: 500 }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "10px 14px", borderRadius: 12,
                  background: msg.role === "user" ? "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)" : "#f0f4f8",
                  color: msg.role === "user" ? "white" : "#1a2a3a",
                  fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.role === "assistant" && <span style={{ marginRight: 6 }}>🧙‍♂️</span>}
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: 12, background: "#f0f4f8", fontSize: 13, color: "#8399a9" }}>
                  🧙‍♂️ <span style={{ animation: "pulse 1.5s infinite" }}>Réflexion en cours...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #e8ecf1", display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écris ton message..."
              disabled={loading}
              style={{
                flex: 1, height: 40, borderRadius: 10, border: "1px solid #dce8f0",
                padding: "0 14px", fontSize: 13, color: "#1a2a3a", outline: "none",
                background: loading ? "#f8fbfd" : "white",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                background: loading || !input.trim() ? "#dce8f0" : "linear-gradient(135deg, #0a3d5f 0%, #1a6b9c 100%)",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
