import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DISC question mapping for Closer test (ids 1-40)
// Questions marked reversed: 10, 20, 30, 40
const DISC_MAP = {
  D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  I: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  S: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  C: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
};
const REVERSED_QUESTIONS = new Set([10, 20, 30, 40]);

function computeDISC(answersMap: Record<number, string>) {
  const scores: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
  const counts: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };

  for (const [dim, ids] of Object.entries(DISC_MAP)) {
    for (const id of ids) {
      const raw = parseInt(answersMap[id]);
      if (isNaN(raw)) continue;
      const val = REVERSED_QUESTIONS.has(id) ? (6 - raw) : raw;
      scores[dim] += val;
      counts[dim]++;
    }
  }

  const result: Record<string, number> = {};
  for (const dim of ["D", "I", "S", "C"]) {
    result[dim] = counts[dim] > 0 ? Math.round((scores[dim] / (counts[dim] * 5)) * 100) : 0;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { submissionId, answers } = await req.json();

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    // Load company knowledge for context
    const { data: knowledgeItems } = await sb.from("company_knowledge").select("title, content, category").eq("active", true);
    const companyContext = (knowledgeItems || []).map((k: any) => `[${k.category}] ${k.title}: ${k.content}`).join("\n\n");

    // Parse answers into map for DISC calculation
    const answersMap: Record<number, string> = {};
    if (typeof answers === "string") {
      // Format: "Q1: value\nQ2: value..."
      answers.split("\n").forEach((line: string) => {
        const match = line.match(/Q(\d+):\s*(.+)/);
        if (match) answersMap[parseInt(match[1])] = match[2].trim();
      });
    }

    const discScores = computeDISC(answersMap);

    const systemPrompt = `Você é um especialista em diagnóstico comportamental de vendedores/closers, com profundo conhecimento em DISC, Eneagrama, psicologia de vendas e performance comercial.

${companyContext ? `CONTEXTO DA EMPRESA (cruze o perfil do vendedor com esta visão):\n${companyContext}\n\n` : ""}Analise as respostas do teste e gere um relatório estruturado com as seções abaixo.

INFORMAÇÃO IMPORTANTE SOBRE O DISC:
O teste DISC usa escala de 1-5 com perguntas armadilha (invertidas) nas questões 10, 20, 30 e 40.
Scores DISC calculados automaticamente: D=${discScores.D}%, I=${discScores.I}%, S=${discScores.S}%, C=${discScores.C}%

REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
- NUNCA cite números de questões, códigos ou referências como "(Q1: B)", "(Q27: Incapaz)", "(Q48: Medo...)" etc.
- Escreva parágrafos bem estruturados com espaçamento entre eles.
- Use linguagem direta e profissional, como se estivesse escrevendo um parecer para um gestor comercial.

SEÇÕES DO RELATÓRIO:

1. **PERFIL DISC**
2. **PERFIL ENEAGRAMA**
3. **VÍCIOS EMOCIONAIS IDENTIFICADOS**
4. **TRAVAS DE ROTINA**
5. **PONTOS DE TRAVAMENTO NA VENDA**
6. **ESTILO NATURAL DE VENDA**
7. **CAPACIDADE DE SUSTENTAÇÃO**
8. **PLANO DE DESTRAVAMENTO** (3 a 5 ações)
9. **NÍVEL DE MATURIDADE COMERCIAL** (1 a 10)
${companyContext ? "10. **ALINHAMENTO COM A VISÃO DA EMPRESA**" : ""}

Seja direto, preciso e use linguagem de gestor comercial. NUNCA referencie números de questões.`;

    // 1) Generate narrative
    const narrativeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise as seguintes respostas do teste comportamental de um vendedor/closer:\n\n${answers}` },
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!narrativeResponse.ok) {
      const errorText = await narrativeResponse.text();
      throw new Error(`AI Gateway error: ${narrativeResponse.status} - ${errorText}`);
    }

    const narrativeData = await narrativeResponse.json();
    const narrativeText = narrativeData.choices?.[0]?.message?.content || "Análise não disponível";

    // 2) Extract structured dashboard data
    const structuredResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em DISC e análise comportamental. Extraia dados estruturados para o dashboard." },
          { role: "user", content: `Respostas:\n${answers}\n\nAnálise:\n${narrativeText}\n\nScores DISC calculados: D=${discScores.D}%, I=${discScores.I}%, S=${discScores.S}%, C=${discScores.C}%\n\nExtraia os dados estruturados.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_dashboard_data",
            description: "Gera dados estruturados para o dashboard comportamental.",
            parameters: {
              type: "object",
              properties: {
                disc: { type: "object", properties: { D: { type: "number" }, I: { type: "number" }, S: { type: "number" }, C: { type: "number" } }, required: ["D", "I", "S", "C"] },
                disc_dominante: { type: "string", enum: ["D", "I", "S", "C"] },
                disc_secundario: { type: "string", enum: ["D", "I", "S", "C"] },
                emotional_vices: { type: "array", items: { type: "object", properties: { name: { type: "string" }, score: { type: "number" } }, required: ["name", "score"] } },
                principal_vice: { type: "string" },
                discipline_scores: { type: "array", items: { type: "object", properties: { name: { type: "string" }, score: { type: "number" } }, required: ["name", "score"] } },
                maturity_level: { type: "number" },
                sales_risk_stages: { type: "array", items: { type: "object", properties: { stage: { type: "string" }, risk: { type: "number" } }, required: ["stage", "risk"] } },
                critical_stage: { type: "string" },
                recovery_time: { type: "string" },
                selling_style: { type: "string" },
              },
              required: ["disc", "disc_dominante", "disc_secundario", "emotional_vices", "principal_vice", "discipline_scores", "maturity_level", "sales_risk_stages", "critical_stage", "recovery_time", "selling_style"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_dashboard_data" } },
        temperature: 0.2,
      }),
    });

    let dashboardData = null;
    if (structuredResponse.ok) {
      const structuredResult = await structuredResponse.json();
      const toolCall = structuredResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try { dashboardData = JSON.parse(toolCall.function.arguments); } catch { console.error("Failed to parse dashboard data"); }
      }
    }

    // Override DISC with calculated scores (more accurate than AI extraction)
    if (dashboardData) {
      dashboardData.disc = discScores;
    }

    const analysis = { narrative: narrativeText, dashboard: dashboardData };

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
