import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { message, tone, target_audience, system_override } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Mensagem muito curta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toneDesc = {
      motivacional: "motivacional, energético, com emojis e entusiasmo",
      profissional: "profissional, direto, corporativo mas humano",
      casual: "casual, amigável, como um colega próximo",
      urgente: "urgente, focado em ação imediata",
      coaching: "coaching, mentoria, com perguntas reflexivas e incentivo",
    }[tone || "profissional"] || "profissional e direto";

    const audienceDesc = {
      all: "toda a equipe (SDRs, Closers e Admins)",
      sdrs: "SDRs (pré-vendedores focados em prospecção)",
      closers: "Closers (vendedores focados em fechamento)",
      admins: "Administradores/Gestores",
      team: "membros da equipe operacional",
    }[target_audience || "all"] || "toda a equipe";

    const systemPrompt = `Você é um copywriter especialista em comunicação interna de equipes de vendas via WhatsApp.

Reescreva a mensagem do admin para ser enviada via WhatsApp para ${audienceDesc}.

Tom desejado: ${toneDesc}

Regras:
- Mantenha o sentido original mas torne mais engajante e profissional
- Use emojis com moderação e propósito
- Formate para WhatsApp (negrito com *texto*, itálico com _texto_)
- Se a mensagem mencionar métricas/dados, use as variáveis disponíveis: {{nome}}, {{data}}, {{role}}, {{metricas_hoje}}, {{metricas_mes}}, {{progresso_meta}}, {{falta_meta}}, {{dicas_ia}}, {{ranking}}
- Limite: máximo 500 caracteres
- Retorne APENAS a mensagem reescrita, sem explicações`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system_override || systemPrompt },
          { role: "user", content: system_override ? message : `Reescreva esta mensagem:\n\n${message}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const rewritten = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (!rewritten) {
      return new Response(JSON.stringify({ error: "IA não retornou conteúdo." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ rewritten }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rewrite-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
