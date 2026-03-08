import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { JarvisOrb as TitanOrb, type OrbState } from "./JarvisOrb";

type Msg = { role: "user" | "assistant"; content: string };

interface JarvisOverlayProps {
  memberId: string;
  memberRole: string;
  onNavigate?: (tab: string) => void;
  onInspect?: (memberId: string) => void;
  onFilter?: (memberId: string, month: string, year: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-agent`;

// Parse action markers from AI response: [ACTION:type:value]
function parseActions(text: string): { type: string; value: string }[] {
  const actions: { type: string; value: string }[] = [];
  const regex = /\[ACTION:([a-z_]+):([^\]]*)\]/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    actions.push({ type: (match[1] || "").toLowerCase(), value: (match[2] || "").trim() });
  }
  return actions;
}

function stripActionMarkers(text: string): string {
  return text.replace(/\[ACTION:[a-z0-9_]+:[^\]]*\]/gi, "").trim();
}

// Legacy navigation detection (fallback for quick local commands)
const NAV_COMMANDS: Record<string, { tab: string; aliases: string[] }> = {
  dashboard: { tab: "dashboard", aliases: ["dashboard", "painel", "inicio", "início", "métricas", "metricas"] },
  team: { tab: "team", aliases: ["equipe", "time", "membros", "pessoas"] },
  goals: { tab: "goals", aliases: ["metas", "objetivos", "goals"] },
  reports: { tab: "reports", aliases: ["relatórios", "relatorios", "reports", "ia"] },
  training: { tab: "training", aliases: ["treinamento", "treinamentos", "capacitação", "cursos", "aulas"] },
  calendars: { tab: "calendars", aliases: ["agenda", "calendário", "calendario", "eventos", "agendas"] },
  whatsapp: { tab: "whatsapp", aliases: ["whatsapp", "automações", "automacoes", "mensagens"] },
  knowledge: { tab: "knowledge", aliases: ["conhecimento", "knowledge", "base"] },
  "dna-mapping": { tab: "dna-mapping", aliases: ["dna", "mapeamento", "teste", "testes"] },
  settings: { tab: "settings", aliases: ["configurações", "configuracoes", "settings", "ajustes"] },
  popups: { tab: "popups", aliases: ["popups", "popup", "motivacional", "motivacionais"] },
  processos: { tab: "processos", aliases: ["processos", "processo", "fluxo", "fluxos"] },
  "closer-entry": { tab: "closer-entry", aliases: ["closer", "registro closer", "entrada closer"] },
  playbooks: { tab: "playbooks", aliases: ["playbooks", "playbook", "guia", "guias"] },
};

function detectNavCommand(text: string): string | null {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const openPhrases = [
    "abrir", "abra", "abre", "ir para", "vai para", "va para", "vai pra", "va pra",
    "mostrar", "mostra", "me mostra", "me mostre", "navegar", "navegue",
    "quero ver", "quero ir", "leva para", "leva pra", "levar para",
    "acessar", "acesse", "acessa", "entrar em", "entra em", "entra no", "entra na",
    "ver a", "ver o", "ver as", "ver os", "veja", "exibir", "exiba",
  ];
  
  for (const phrase of openPhrases) {
    if (lower.includes(phrase)) {
      for (const [, config] of Object.entries(NAV_COMMANDS)) {
        for (const alias of config.aliases) {
          const normalizedAlias = alias.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (lower.includes(normalizedAlias)) {
            return config.tab;
          }
        }
      }
    }
  }
  return null;
}


// Neural network particles
function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    interface Node { x: number; y: number; vx: number; vy: number; r: number; pulse: number; }
    const nodes: Node[] = [];
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const count = 40;

    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // Update positions
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.02;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.3;
            ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const glow = 0.5 + 0.5 * Math.sin(n.pulse);
        const alpha = 0.4 + glow * 0.6;
        
        // Glow
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        gradient.addColorStop(0, `rgba(168, 85, 247, ${alpha * 0.5})`);
        gradient.addColorStop(1, "rgba(168, 85, 247, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = `rgba(200, 140, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

// TITAN overlay component (formerly Jarvis)

export function JarvisOverlay({ memberId, memberRole, onNavigate, onInspect, onFilter }: JarvisOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const orbState: OrbState = isLoading ? "processing" : "idle";

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+J or Cmd+J
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Check for navigation command
    const navTarget = detectNavCommand(text);
    if (navTarget && onNavigate) {
      const tabNames: Record<string, string> = {
        dashboard: "Dashboard", team: "Equipe", goals: "Metas", reports: "Relatórios IA",
        training: "Treinamentos", calendars: "Agendas", whatsapp: "WhatsApp",
        knowledge: "Conhecimento IA", "dna-mapping": "Sales DNA", settings: "Configurações",
        popups: "Popups", processos: "Processos", "closer-entry": "Registro Closer",
        playbooks: "Playbooks",
      };
      const name = tabNames[navTarget] || navTarget;
      setMessages(prev => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: `🚀 Abrindo **${name}** para você!` },
      ]);
      setInput("");
      
      setTimeout(() => {
        onNavigate(navTarget);
        setIsOpen(false);
      }, 800);
      return;
    }

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages(prev => [...prev, userMsg]);
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
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${err.error}` }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
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

      // Check for action markers from AI agent: [ACTION:type:value]
      const actions = parseActions(assistantSoFar);
      if (actions.length > 0) {
        const cleanContent = stripActionMarkers(assistantSoFar);
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "assistant" ? { ...m, content: cleanContent } : m));
        
        setTimeout(() => {
          for (const action of actions) {
            if (action.type === "navigate" && onNavigate) {
              onNavigate(action.value);
            } else if (action.type === "inspect" && onInspect) {
              onInspect(action.value);
            } else if (action.type === "filter" && onFilter) {
              const [fMemberId, fMonth, fYear] = action.value.split("|");
              onFilter(fMemberId || "", fMonth || "", fYear || "");
            }
          }
          setIsOpen(false);
        }, 1200);
      } else {
        // Legacy fallback: check old [NAVIGATE:page] pattern
        const navMatch = assistantSoFar.match(/\[NAVIGATE:([a-z-]+)\]/);
        if (navMatch && onNavigate) {
          const cleanContent = assistantSoFar.replace(/\[NAVIGATE:[a-z-]+\]/g, "").trim();
          setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "assistant" ? { ...m, content: cleanContent } : m));
          setTimeout(() => {
            onNavigate(navMatch[1]);
            setIsOpen(false);
          }, 1200);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão." }]);
    }

    setIsLoading(false);
  };

  const handleButtonClick = useCallback(() => {
    setIsOpen(true);
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50" title="TITAN (Ctrl+Alt+J)">
          <TitanOrb state={orbState} size="sm" onClick={handleButtonClick} />
        </div>
      )}

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => { setIsOpen(false); }}
            />

            {/* Main panel */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-[95vw] max-w-2xl h-[85vh] max-h-[700px] rounded-3xl overflow-hidden border border-purple-500/20 bg-[hsl(var(--background))]/95 shadow-[0_0_80px_rgba(168,85,247,0.15)]"
            >
              {/* Neural background */}
              <NeuralBackground />

              {/* Content */}
              <div className="relative z-10 flex flex-col h-full">
                {/* Header — compact when conversation started, hidden when welcome */}
                {messages.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                      <TitanOrb state={orbState} size="sm" />
                      <div>
                        <h2 className="text-sm font-bold text-white tracking-tight">TITAN</h2>
                        <p className="text-[9px] text-purple-300/50 uppercase tracking-widest">
                          {orbState === "processing" ? "Processando..." : "Strategic Intelligence Engine"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setIsOpen(false); }}
                      className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Close button for welcome screen */}
                {messages.length === 0 && (
                  <div className="absolute top-4 right-4 z-20">
                    <button
                      onClick={() => { setIsOpen(false); }}
                      className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-6 pb-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-5">
                      {/* Branded Hero */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="relative"
                      >
                        <TitanOrb state="idle" size="lg" />
                        <motion.div
                          className="absolute -inset-4 rounded-full"
                          style={{ background: "radial-gradient(circle, rgba(74,158,255,0.15) 0%, transparent 70%)" }}
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="space-y-1"
                      >
                        <h3 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
                          T I T A N
                        </h3>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-purple-300/50 font-medium">
                          Strategic Intelligence Engine
                        </p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                        className="space-y-3 max-w-sm"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: "📊", label: "Dados" },
                            { icon: "🎯", label: "Metas" },
                            { icon: "👥", label: "Equipe" },
                            { icon: "📱", label: "WhatsApp" },
                            { icon: "🧠", label: "IA" },
                            { icon: "⚡", label: "Ações" },
                          ].map((cap, i) => (
                            <motion.div
                              key={cap.label}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8 + i * 0.08 }}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                            >
                              <span className="text-xs">{cap.icon}</span>
                              <span className="text-[10px] text-purple-200/60">{cap.label}</span>
                            </motion.div>
                          ))}
                        </div>

                        <p className="text-[11px] text-purple-200/40 leading-relaxed">
                          Controle total do seu time comercial. Pergunte qualquer coisa.
                        </p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        className="flex flex-wrap gap-2 justify-center"
                      >
                        {["Como está a performance?", "Ranking de conexões", "Quem é você?"].map(s => (
                          <button
                            key={s}
                            onClick={() => { setInput(s); }}
                            className="text-[10px] px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-300/80 hover:bg-purple-500/15 hover:text-purple-200 transition-all hover:scale-105"
                          >
                            {s}
                          </button>
                        ))}
                      </motion.div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-2.5 max-w-[85%]",
                        msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1",
                        msg.role === "user" ? "bg-purple-500/20 text-purple-300" : "bg-violet-500/20 text-violet-300"
                      )}>
                        {msg.role === "user" ? <User size={12} /> : <TitanOrb state="idle" size="sm" className="w-6 h-6" />}
                      </div>
                      <div className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-purple-600/20 text-purple-100 rounded-br-md border border-purple-500/10"
                          : "bg-white/5 text-purple-50/90 rounded-bl-md border border-white/5"
                      )}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_li]:mb-1 [&_h1]:text-base [&_h2]:text-sm [&_code]:bg-purple-900/30 [&_code]:px-1 [&_code]:rounded [&_strong]:text-purple-200">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-2.5">
                      <TitanOrb state="processing" size="sm" className="w-6 h-6 shrink-0" />
                      <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                        <div className="flex gap-1">
                          <motion.div className="w-1.5 h-1.5 rounded-full bg-purple-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
                          <motion.div className="w-1.5 h-1.5 rounded-full bg-purple-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
                          <motion.div className="w-1.5 h-1.5 rounded-full bg-purple-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="px-6 pb-6 pt-2">
                  <div className="flex items-center gap-2 bg-white/5 border border-purple-500/15 rounded-2xl px-4 py-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                      placeholder="Digite um comando..."
                      className="flex-1 bg-transparent text-sm text-purple-50 placeholder:text-purple-300/30 outline-none"
                      disabled={isLoading}
                    />
                    <button
                      onClick={send}
                      disabled={isLoading || !input.trim()}
                      className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 transition-colors disabled:opacity-30 shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                  <p className="text-[9px] text-purple-400/30 text-center mt-2">
                    ESC para fechar • TITAN — Assistente de Alta Performance
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
