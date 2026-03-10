import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { moduleTitle, courseTitle, existingLessons, count } = await req.json();
    if (!moduleTitle) throw new Error("moduleTitle is required");

    const systemPrompt = `Você é um especialista em design instrucional para equipes comerciais (SDRs e Closers).

O usuário quer gerar aulas para um módulo específico de um curso já existente.

REGRAS:
- Gere exatamente ${count || 3} aulas
- Títulos curtos e objetivos (máx 50 chars)
- Descrições práticas e diretas (1-2 frases)
- Cada aula deve ter uma "dica_gravacao" com sugestões práticas
- As aulas devem ser progressivas e complementar as existentes
- Foque em conteúdo prático e aplicável

${existingLessons?.length ? `Aulas já existentes no módulo (NÃO repita):\n${existingLessons.map((l: string) => `- ${l}`).join("\n")}` : ""}

Retorne EXATAMENTE um JSON:
{
  "lessons": [
    {
      "title": "Nome da Aula",
      "description": "O que será ensinado",
      "dica_gravacao": "Dica prática de gravação"
    }
  ]
}

Responda APENAS com o JSON, sem texto extra.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Curso: ${courseTitle || "Sem título"}\nMódulo: ${moduleTitle}\nGere ${count || 3} aulas.` },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      throw new Error(`AI error: ${response.status} - ${t}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || "";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-lessons error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
