import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { idea, targetRole, numModules, numLessonsPerModule } = await req.json();
    if (!idea) throw new Error("idea is required");

    const hasCustomStructure = numModules && numLessonsPerModule;
    const structureRules = hasCustomStructure
      ? `- Crie EXATAMENTE ${numModules} módulos
- Cada módulo deve ter EXATAMENTE ${numLessonsPerModule} aulas
- Total de aulas: ${numModules * numLessonsPerModule}`
      : `- Máximo de 15 aulas no total (distribuídas entre os módulos)
- Cada módulo deve ter 2-5 aulas
- Máximo de 5 módulos`;

    const systemPrompt = `Você é um especialista em design instrucional para equipes comerciais (SDRs e Closers).

O usuário vai descrever uma ideia de curso e você deve gerar a estrutura completa.

REGRAS IMPORTANTES:
${structureRules}
- Títulos curtos e objetivos (máx 50 chars)
- Descrições práticas e diretas (1-2 frases)
- Cada aula deve ter uma "dica_gravacao" com sugestões práticas de como gravar aquela aula (equipamento, cenário, duração ideal, formato sugerido, roteiro resumido)
- O curso deve ser progressivo (do básico ao avançado)
- Foque em conteúdo prático e aplicável

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "title": "Título do Curso",
  "description": "Descrição breve do curso",
  "modules": [
    {
      "title": "Nome do Módulo",
      "description": "Descrição do módulo",
      "lessons": [
        {
          "title": "Nome da Aula",
          "description": "O que será ensinado",
          "dica_gravacao": "Dica prática de como gravar: duração sugerida (ex: 5-8 min), formato (talking head, tela compartilhada, roleplay), roteiro resumido, equipamentos mínimos"
        }
      ]
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
          { role: "user", content: `Ideia do curso: ${idea}\nPúblico-alvo: ${targetRole === "all" ? "SDRs e Closers" : targetRole === "sdr" ? "SDRs" : "Closers"}` },
        ],
        temperature: 0.4,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
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
    console.error("generate-course error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
