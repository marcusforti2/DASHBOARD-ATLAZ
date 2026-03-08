import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, Sparkles, Plus, MessageSquare, Trash2, Clock, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface Conversation {
  id: string;
  title: string;
  tool: string;
  created_at: string;
  updated_at: string;
}

interface AiChatProps {
  memberId: string;
  tool?: string;
  placeholder?: string;
  compact?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;

export function AiChat({ memberId, tool = "chat", placeholder, compact = false }: AiChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(!compact);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    const { data } = await supabase
      .from("coach_conversations")
      .select("id, title, tool, created_at, updated_at")
      .eq("member_id", memberId)
      .eq("tool", tool)
      .order("updated_at", { ascending: false })
      .limit(30);
    setConversations(data || []);
  }, [memberId, tool]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return; }
    const loadMessages = async () => {
      const { data } = await supabase
        .from("coach_messages")
        .select("role, content")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      const msgs = (data || []).filter(m => m.role !== "system") as Msg[];
      setMessages(msgs);
    };
    loadMessages();
  }, [activeConversationId]);

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("coach_conversations").delete().eq("id", convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConversationId === convId) startNewConversation();
    toast.success("Conversa excluída");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          tool,
          memberId,
          conversationId: activeConversationId,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (resp.status === 429) toast.error("Limite de requisições excedido. Aguarde.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${err.error || "Erro ao conectar com a IA"}` }]);
        setIsLoading(false);
        return;
      }

      // Get conversation ID from header
      const newConvId = resp.headers.get("X-Conversation-Id");
      if (newConvId && !activeConversationId) {
        setActiveConversationId(newConvId);
        fetchConversations();
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Erro de conexão. Tente novamente." }]);
    }

    setIsLoading(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full border-r border-border bg-card/30">
      <div className="p-2 border-b border-border/50">
        <button
          onClick={startNewConversation}
          className="w-full flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus size={14} />
          Nova Conversa
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none p-1.5 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">Nenhuma conversa salva</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs",
              activeConversationId === conv.id
                ? "bg-primary/10 border border-primary/20"
                : "hover:bg-muted/50"
            )}
            onClick={() => setActiveConversationId(conv.id)}
          >
            <MessageSquare size={12} className="shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-foreground font-medium text-[11px]">{conv.title}</p>
              <p className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                <Clock size={8} />
                {new Date(conv.updated_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
              onClick={(e) => deleteConversation(conv.id, e)}
            >
              <Trash2 size={11} className="text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("flex", compact ? "h-[400px]" : "h-[600px]")}>
      {/* Sidebar */}
      {showSidebar && (
        <div className={cn("shrink-0", compact ? "w-44" : "w-52")}>
          {sidebarContent}
        </div>
      )}

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSidebar ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
            </button>
            <span className="text-[10px] text-muted-foreground">
              {activeConversationId ? "Conversa ativa" : "Nova conversa"}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none space-y-3 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles size={24} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Coach IA</p>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                {placeholder || "Pergunte sobre estratégias, scripts, análise de performance ou peça ajuda com qualquer desafio comercial."}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2.5 max-w-[90%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "user"
                    ? "bg-primary/20 text-primary"
                    : "bg-accent/20 text-accent"
                )}
              >
                {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_li]:mb-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:bg-background/30 [&_code]:px-1 [&_code]:rounded">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 bg-card/50">
          <div className="flex items-center gap-2">

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={placeholder || "Digite sua pergunta..."}
              className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm text-secondary-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
              disabled={isLoading}
            />
            <button
              onClick={send}
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
