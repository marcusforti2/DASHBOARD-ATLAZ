import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard
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

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Descreva a automação que deseja criar (mínimo 5 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente que cria automações de mensagens WhatsApp para uma equipe de vendas (SDRs e Closers).

O sistema possui estas métricas disponíveis:
- SDR: conexoes, conexoes_aceitas, abordagens, inmail, follow_up, numero, lig_agendada
- Closer: lig_realizada, reuniao_agendada, reuniao_realizada

Variáveis disponíveis no template de mensagem (use entre chaves duplas):
- {{nome}} - Nome do membro
- {{data}} - Data atual
- {{role}} - Função (SDR/Closer)
- {{metricas_hoje}} - Métricas realizadas hoje
- {{metricas_mes}} - Acumulado do mês
- {{progresso_meta}} - Progresso vs meta com % e emojis
- {{falta_meta}} - Quanto falta para bater a meta
- {{dicas_ia}} - Dicas personalizadas geradas pela IA

Horários de cron (UTC-3 → UTC):
- 8h BRT = 11 UTC → "0 11 * * 1-5" (seg-sex)
- 12h BRT = 15 UTC → "0 15 * * 1-5"
- 18h BRT = 21 UTC → "0 21 * * 1-5"
- Toda segunda 9h = "0 12 * * 1"

Público alvo (target_audience): "all" (todos membros + admins), "sdrs" (só SDRs), "closers" (só Closers), "admins" (só administradores), "team" (só membros da equipe, sem admins)

Responda APENAS com um JSON válido (sem markdown, sem explicação) com esta estrutura:
{
  "name": "Nome curto da automação",
  "description": "Descrição do que faz",
  "message_template": "Template da mensagem com variáveis {{...}}",
  "schedule_cron": "expressão cron ou null se manual",
  "target_audience": "all" | "sdrs" | "closers",
  "target_role": null | "sdr" | "closer",
  "include_metrics": true/false,
  "include_ai_tips": true/false
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "IA retornou formato inválido. Tente reformular o pedido." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!parsed.name || !parsed.message_template) {
      return new Response(JSON.stringify({ error: "IA não gerou campos obrigatórios. Tente ser mais específico." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ automation: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-automation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
