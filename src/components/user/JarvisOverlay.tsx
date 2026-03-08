import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Send, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { JarvisOrb, type OrbState } from "./JarvisOrb";

type Msg = { role: "user" | "assistant"; content: string };

interface JarvisOverlayProps {
  memberId: string;
  memberRole: string;
  onNavigate?: (tab: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-agent`;

// Navigation map for voice commands (admin views)
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

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[-*+]\s/g, "")
    .replace(/\d+\.\s/g, "")
    .replace(/>\s/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
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

// Removed local JarvisOrb — now using JarvisOrb from ./JarvisOrb

export function JarvisOverlay({ memberId, memberRole, onNavigate }: JarvisOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [handsFreeText, setHandsFreeText] = useState("");
  const [handsFreeStatus, setHandsFreeStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");

  // Compute orb state
  const orbState: OrbState = isSpeaking || handsFreeStatus === "speaking" ? "speaking"
    : isLoading || handsFreeStatus === "processing" ? "processing"
    : isListening || handsFreeStatus === "listening" ? "listening"
    : "idle";
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSendRef = useRef(false);
  const handsFreeRef = useRef(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Ctrl+J or Cmd+J
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        audioRef.current?.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Auto-start listening when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        // Auto-start voice recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition && !isListening && !isLoading) {
          const recognition = new SpeechRecognition();
          recognition.lang = "pt-BR";
          recognition.continuous = false;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            setInput(transcript);
            if (event.results[event.results.length - 1].isFinal) {
              setIsListening(false);
              // Auto-send after speech ends
              autoSendRef.current = true;
            }
          };
          recognition.onerror = () => setIsListening(false);
          recognition.onend = () => setIsListening(false);

          recognitionRef.current = recognition;
          recognition.start();
          setIsListening(true);
        }
      }, 400);
    } else {
      // Stop listening when closing
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-send after speech recognition finalizes
  useEffect(() => {
    if (autoSendRef.current && input.trim() && !isListening && !isLoading) {
      autoSendRef.current = false;
      const timer = setTimeout(() => {
        if (handsFreeRef.current) {
          handsFreeeSend(input.trim());
        } else {
          send();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [input, isListening]);

  // TTS via ElevenLabs (+ browser fallback)
  const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
  const speak = useCallback(async (text: string, autoListenAfter = false) => {
    const clean = stripMarkdown(text);
    const fallbackSpeak = () => {
      try {
        if (!("speechSynthesis" in window) || !clean || clean.length < 3) {
          if (autoListenAfter && handsFreeRef.current) startHandsFreeListen();
          return;
        }

        if (autoListenAfter) setHandsFreeStatus("speaking");
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = "pt-BR";
        utterance.rate = 1.05;
        utterance.pitch = 0.9; // Slightly lower for masculine tone
        utterance.volume = 1.0;

        // Select best PT-BR MALE voice: prioritize Google > Microsoft > named male voices
        const voices = window.speechSynthesis.getVoices();
        const ptBrVoices = voices.filter((v) => v.lang === "pt-BR" || v.lang === "pt_BR");
        const ptVoices = ptBrVoices.length > 0 ? ptBrVoices : voices.filter((v) => /^pt/i.test(v.lang));
        
        // Try to find male voices first (avoid female/feminine names)
        const femaleNames = /maria|ana|francisca|julia|leticia|female|feminino|luciana|fernanda|raquel|vitoria|camila/i;
        const maleNames = /daniel|luciano|antonio|marcos|pedro|ricardo|thiago|google br|male|masculino/i;
        
        const googleMale = ptVoices.find((v) => /google/i.test(v.name) && !femaleNames.test(v.name));
        const namedMale = ptVoices.find((v) => maleNames.test(v.name));
        const microsoftMale = ptVoices.find((v) => /microsoft|edge/i.test(v.name) && !femaleNames.test(v.name));
        const anyNonFemale = ptVoices.find((v) => !femaleNames.test(v.name));
        const anyPt = ptVoices[0];
        
        const bestVoice = googleMale || namedMale || microsoftMale || anyNonFemale || anyPt;
        if (bestVoice) {
          utterance.voice = bestVoice;
          console.log("Jarvis TTS voice:", bestVoice.name, bestVoice.lang);
        }

        utterance.onend = () => {
          if (autoListenAfter && handsFreeRef.current) startHandsFreeListen();
        };
        utterance.onerror = () => {
          if (autoListenAfter && handsFreeRef.current) startHandsFreeListen();
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        if (autoListenAfter && handsFreeRef.current) startHandsFreeListen();
      }
    };

    try {
      audioRef.current?.pause();
      if (!clean || clean.length < 3) {
        if (autoListenAfter && handsFreeRef.current) startHandsFreeListen();
        return;
      }
      if (autoListenAfter) setHandsFreeStatus("speaking");

      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: clean }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.warn("TTS remoto falhou, usando voz local:", resp.status, err?.error ?? "unknown");
        fallbackSpeak();
        return;
      }

      const blob = await resp.blob();
      if (!blob || blob.size === 0) {
        fallbackSpeak();
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (autoListenAfter && handsFreeRef.current) startHandsFreeListen();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        fallbackSpeak();
      };
      audio.play().catch(() => fallbackSpeak());
    } catch (e) {
      console.warn("TTS error, usando fallback local:", e);
      fallbackSpeak();
    }
  }, []);

  // Hands-free listen function with retry limit
  const handsFreeRetryRef = useRef(0);
  const MAX_HANDSFREE_RETRIES = 2;

  const startHandsFreeListen = useCallback(() => {
    if (!handsFreeRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setHandsFreeStatus("listening");
    setHandsFreeText("🎤 Ouvindo...");

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setHandsFreeText(`🎤 ${transcript}`);
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
        handsFreeRetryRef.current = 0; // reset retries on success
        autoSendRef.current = true;
      }
    };
    recognition.onerror = (e: any) => {
      setIsListening(false);
      // Only retry on no-speech or aborted, with limit
      if (handsFreeRef.current && handsFreeRetryRef.current < MAX_HANDSFREE_RETRIES && 
          (e.error === "no-speech" || e.error === "aborted")) {
        handsFreeRetryRef.current++;
        setTimeout(() => startHandsFreeListen(), 2000);
      } else {
        // Stop hands-free mode after max retries or other errors
        setHandsFreeStatus("idle");
        setHandsFreeText("");
        handsFreeRetryRef.current = 0;
      }
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  // Hands-free send (no overlay)
  const handsFreeeSend = useCallback(async (text: string) => {
    if (!text || isLoading) return;
    audioRef.current?.pause();

    // Nav command
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
      setHandsFreeText(`🚀 Abrindo ${name}...`);
      speak(`Abrindo ${name}`, true);
      setTimeout(() => onNavigate(navTarget), 800);
      return;
    }

    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setHandsFreeStatus("processing");
    setHandsFreeText("⚡ Processando...");

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        setHandsFreeText(`❌ ${err.error}`);
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${err.error}` }]);
        setIsLoading(false);
        if (handsFreeRef.current) setTimeout(() => startHandsFreeListen(), 2000);
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
              setHandsFreeText(assistantSoFar);
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

      // Handle nav markers
      const navMatch = assistantSoFar.match(/\[NAVIGATE:([a-z-]+)\]/);
      if (navMatch && onNavigate) {
        const cleanContent = assistantSoFar.replace(/\[NAVIGATE:[a-z-]+\]/g, "").trim();
        setHandsFreeText(cleanContent);
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "assistant" ? { ...m, content: cleanContent } : m));
        speak(cleanContent, true);
        setTimeout(() => onNavigate(navMatch[1]), 1200);
      } else if (assistantSoFar) {
        speak(assistantSoFar, true);
      } else {
        if (handsFreeRef.current) startHandsFreeListen();
      }
    } catch {
      setHandsFreeText("❌ Erro de conexão.");
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão." }]);
      if (handsFreeRef.current) setTimeout(() => startHandsFreeListen(), 2000);
    }

    setIsLoading(false);
  }, [messages, isLoading, speak, onNavigate]);

  // (speak moved above)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // STT
  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Navegador não suporta reconhecimento de voz.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false);
        // Auto-send after manual mic toggle too
        autoSendRef.current = true;
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    audioRef.current?.pause();

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
      speak(`Abrindo ${name}`);
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

      // Check for navigation markers from AI agent
      const navMatch = assistantSoFar.match(/\[NAVIGATE:([a-z-]+)\]/);
      if (navMatch && onNavigate) {
        // Strip marker from displayed text
        const cleanContent = assistantSoFar.replace(/\[NAVIGATE:[a-z-]+\]/g, "").trim();
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.role === "assistant" ? { ...m, content: cleanContent } : m));
        if (cleanContent) speak(cleanContent);
        setTimeout(() => {
          onNavigate(navMatch[1]);
          setIsOpen(false);
        }, 1200);
      } else if (assistantSoFar) {
        speak(assistantSoFar);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão." }]);
    }

    setIsLoading(false);
  };

  // Handle button clicks: single = open overlay, double = hands-free mode
  const handleButtonClick = useCallback(() => {
    if (clickTimerRef.current) {
      // Double click detected
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Toggle hands-free mode
      if (handsFreeRef.current) {
        handsFreeRef.current = false;
        setHandsFreeMode(false);
        setHandsFreeStatus("idle");
        setHandsFreeText("");
        recognitionRef.current?.stop();
        audioRef.current?.pause();
        setIsListening(false);
      } else {
        handsFreeRef.current = true;
        setHandsFreeMode(true);
        startHandsFreeListen();
      }
    } else {
      // Wait to see if it's a double click
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        if (!handsFreeRef.current) {
          setIsOpen(true);
        }
      }, 300);
    }
  }, [startHandsFreeListen]);

  // Stop hands-free on ESC
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && handsFreeRef.current) {
        handsFreeRef.current = false;
        setHandsFreeMode(false);
        setHandsFreeStatus("idle");
        setHandsFreeText("");
        recognitionRef.current?.stop();
        audioRef.current?.pause();
        setIsListening(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={handleButtonClick}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full",
          "bg-gradient-to-br from-purple-600 to-violet-700",
          "shadow-[0_0_30px_rgba(168,85,247,0.4)]",
          "flex items-center justify-center",
          "hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] transition-shadow",
          isOpen && "hidden",
          handsFreeMode && "shadow-[0_0_40px_rgba(168,85,247,0.7)]"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={handsFreeMode ? {
          boxShadow: ["0 0 30px rgba(168,85,247,0.5)", "0 0 60px rgba(168,85,247,0.9)", "0 0 30px rgba(168,85,247,0.5)"],
        } : {}}
        transition={handsFreeMode ? { duration: 1.2, repeat: Infinity } : {}}
        title={handsFreeMode ? "Modo mãos-livres ativo (2x clique para parar)" : "Jarvis (Ctrl+Alt+J) • 2x clique = mãos-livres"}
      >
        {handsFreeMode ? (
          handsFreeStatus === "listening" ? <Mic size={24} className="text-white" /> :
          handsFreeStatus === "processing" ? <Loader2 size={24} className="text-white animate-spin" /> :
          <Bot size={24} className="text-white" />
        ) : (
          <Bot size={24} className="text-white" />
        )}
      </motion.button>

      {/* Hands-free floating bubble */}
      <AnimatePresence>
        {handsFreeMode && handsFreeText && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 max-w-sm"
          >
            <div className="bg-[hsl(var(--background))]/95 backdrop-blur-lg border border-purple-500/20 rounded-2xl px-4 py-3 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={10} className="text-purple-300" />
                </div>
                <p className="text-sm text-purple-50/90 leading-relaxed max-h-40 overflow-y-auto">
                  {handsFreeText}
                </p>
              </div>
              <p className="text-[8px] text-purple-400/40 mt-1 text-right">ESC para parar • 2x clique no botão</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              onClick={() => { setIsOpen(false); audioRef.current?.pause(); }}
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
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <JarvisOrb isListening={isListening} isLoading={isLoading} />
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">JARVIS</h2>
                      <p className="text-[10px] text-purple-300/70 uppercase tracking-widest">
                        {isListening ? "Ouvindo..." : isLoading ? "Processando..." : "Ctrl+Alt+J • Pronto para ajudar"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setIsOpen(false); audioRef.current?.pause(); }}
                    className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-6 pb-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                      <p className="text-sm text-purple-200/60 max-w-xs">
                        Fale ou digite. Posso responder perguntas, abrir páginas e te ajudar com vendas.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {["Abrir ferramentas IA", "Como está minha performance?", "Abrir agenda"].map(s => (
                          <button
                            key={s}
                            onClick={() => { setInput(s); }}
                            className="text-[10px] px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-300/80 hover:bg-purple-500/15 hover:text-purple-200 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
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
                        {msg.role === "user" ? <User size={12} /> : <Bot size={12} />}
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
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
                        <Bot size={12} />
                      </div>
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
                    <button
                      onClick={toggleListening}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0",
                        isListening
                          ? "bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                          : "bg-white/5 text-purple-300/60 hover:text-purple-200 hover:bg-white/10"
                      )}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                      placeholder={isListening ? "🎤 Ouvindo..." : "Fale ou digite um comando..."}
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
                    ESC para fechar • Diga "abrir agenda", "abrir ferramentas" etc.
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
