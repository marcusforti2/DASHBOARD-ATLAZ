import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISC_MAP = {
  D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  I: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  S: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  C: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
};
const REVERSED_QUESTIONS = new Set([10, 20, 30, 40]);
const NEGOTIATION_QUESTIONS = [81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95];

function computeDISC(answersMap: Record<number, string>) {
  const scores: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
  const counts: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const [dim, ids] of Object.entries(DISC_MAP)) {
    for (const id of ids) {
      const raw = parseInt(answersMap[id]);
      if (isNaN(raw)) continue;
      scores[dim] += REVERSED_QUESTIONS.has(id) ? (6 - raw) : raw;
      counts[dim]++;
    }
  }
  const result: Record<string, number> = {};
  for (const dim of ["D", "I", "S", "C"]) {
    result[dim] = counts[dim] > 0 ? Math.round((scores[dim] / (counts[dim] * 5)) * 100) : 0;
  }
  return result;
}

function computeNegotiationScore(answersMap: Record<number, string>) {
  let total = 0, count = 0;
  for (const id of NEGOTIATION_QUESTIONS) {
    const raw = parseInt(answersMap[id]);
    if (!isNaN(raw)) { total += raw; count++; }
  }
  return count > 0 ? Math.round((total / (count * 5)) * 100) : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { submissionId, answers } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const { data: knowledgeItems } = await sb.from("company_knowledge").select("title, content, category").eq("active", true);
    const companyContext = (knowledgeItems || []).map((k: any) => `[${k.category}] ${k.title}: ${k.content}`).join("\n\n");

    const answersMap: Record<number, string> = {};
    if (typeof answers === "string") {
      answers.split("\n").forEach((line: string) => {
        const match = line.match(/Q(\d+):\s*(.+)/);
        if (match) answersMap[parseInt(match[1])] = match[2].trim();
      });
    }

    const discScores = computeDISC(answersMap);
    const negotiationScore = computeNegotiationScore(answersMap);

    const systemPrompt = `Você é um especialista em diagnóstico comportamental de vendedores/closers, com profundo conhecimento em DISC, psicologia de vendas, negociação e performance comercial.

${companyContext ? `CONTEXTO DA EMPRESA:\n${companyContext}\n\n` : ""}DADOS CALCULADOS:
- DISC: D=${discScores.D}%, I=${discScores.I}%, S=${discScores.S}%, C=${discScores.C}%
- Score de Negociação: ${negotiationScore}%

O TESTE TEM 120 PERGUNTAS EM 3 BLOCOS:
- Bloco 1 (Q1-40): DISC com escala 1-5 e perguntas armadilha invertidas
- Bloco 2 (Q41-80): Diagnóstico, condução e qualidade de venda (abertas)
- Bloco 3 (Q81-120): Negociação, objeção e pressão (escala + cenários + abertas)

REGRAS: NUNCA cite números de questões. Linguagem de gestor comercial.

SEÇÕES:
1. **PERFIL DISC DO CLOSER**
2. **CLASSIFICAÇÃO** (Estruturador / Relacional / Dominante / Analítico)
3. **TENDÊNCIA COMPORTAMENTAL** — padrão dominante de atuação
4. **MAPA EMOCIONAL** — como as emoções influenciam a venda
5. **PONTOS FORTES** — o que diferencia este closer
6. **PONTOS FRACOS** — onde perde performance
7. **VÍCIOS EMOCIONAIS** — padrões automáticos que sabotam
8. **TRAVAS TÉCNICAS** — gaps de conhecimento/processo
9. **TRAVAS EMOCIONAIS** — bloqueios psicológicos em venda
10. **FORÇAS E VIRTUDES** — qualidades naturais
11. **HABILIDADES DESENVOLVIDAS** — competências adquiridas
12. **SUPER PODER** — a habilidade excepcional deste closer
13. **NÍVEL DE EXECUÇÃO** (1-10) — capacidade de executar com consistência
14. **MATURIDADE COMERCIAL** (1-10)
15. **POSTURA EM NEGOCIAÇÃO** — firmeza, relação com dinheiro, silêncio
16. **PONTOS DE ATENÇÃO** — riscos que o gestor deve monitorar
17. **COMO POTENCIALIZAR** — plano de 3-5 ações para maximizar resultado
${companyContext ? "18. **ALINHAMENTO COM A EMPRESA**" : ""}`;

    // 1) Narrative
    const narrativeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise as respostas do teste completo:\n\n${answers}` },
        ],
        temperature: 0.4,
        max_tokens: 6000,
      }),
    });

    if (!narrativeResponse.ok) {
      const errorText = await narrativeResponse.text();
      throw new Error(`AI Gateway error: ${narrativeResponse.status} - ${errorText}`);
    }

    const narrativeData = await narrativeResponse.json();
    const narrativeText = narrativeData.choices?.[0]?.message?.content || "Análise não disponível";

    // 2) Structured dashboard data
    const structuredResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extraia dados estruturados para dashboard visual de um closer. Baseie-se na análise narrativa e respostas." },
          { role: "user", content: `Análise:\n${narrativeText}\n\nDISC: D=${discScores.D}% I=${discScores.I}% S=${discScores.S}% C=${discScores.C}%, Negociação=${negotiationScore}%\n\nExtraia todos os dados estruturados.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_dashboard_data",
            description: "Gera dados completos para dashboard visual do closer.",
            parameters: {
              type: "object",
              properties: {
                disc: { type: "object", properties: { D: { type: "number" }, I: { type: "number" }, S: { type: "number" }, C: { type: "number" } }, required: ["D", "I", "S", "C"] },
                disc_dominante: { type: "string", enum: ["D", "I", "S", "C"] },
                disc_secundario: { type: "string", enum: ["D", "I", "S", "C"] },
                closer_type: { type: "string", enum: ["Estruturador", "Relacional", "Dominante", "Analítico"] },
                tendency: { type: "string", description: "Tendência comportamental dominante em 2-4 palavras" },
                negotiation_score: { type: "number" },
                maturity_level: { type: "number", description: "1-10" },
                execution_level: { type: "number", description: "1-10" },
                super_power: { type: "string", description: "A habilidade excepcional em 2-5 palavras" },
                selling_style: { type: "string" },
                recovery_time: { type: "string" },
                emotional_vices: { type: "array", items: { type: "object", properties: { name: { type: "string" }, score: { type: "number", description: "0-10" } }, required: ["name", "score"] } },
                principal_vice: { type: "string" },
                strengths: { type: "array", items: { type: "string" }, description: "3-5 pontos fortes" },
                weaknesses: { type: "array", items: { type: "string" }, description: "3-5 pontos fracos" },
                technical_blocks: { type: "array", items: { type: "string" }, description: "2-4 travas técnicas" },
                emotional_blocks: { type: "array", items: { type: "string" }, description: "2-4 travas emocionais" },
                virtues: { type: "array", items: { type: "string" }, description: "3-5 forças e virtudes naturais" },
                skills: { type: "array", items: { type: "string" }, description: "3-5 habilidades desenvolvidas" },
                attention_points: { type: "array", items: { type: "string" }, description: "3-5 pontos de atenção para o gestor" },
                action_plan: { type: "array", items: { type: "string" }, description: "3-5 ações para potencializar" },
                emotional_map: { type: "array", items: { type: "object", properties: { area: { type: "string" }, level: { type: "number", description: "1-10" } }, required: ["area", "level"] }, description: "Mapa emocional com 4-6 áreas" },
                sales_risk_stages: { type: "array", items: { type: "object", properties: { stage: { type: "string" }, risk: { type: "number" } }, required: ["stage", "risk"] } },
                critical_stage: { type: "string" },
                discipline_scores: { type: "array", items: { type: "object", properties: { name: { type: "string" }, score: { type: "number" } }, required: ["name", "score"] } },
              },
              required: ["disc", "disc_dominante", "disc_secundario", "closer_type", "tendency", "negotiation_score", "maturity_level", "execution_level", "super_power", "selling_style", "recovery_time", "emotional_vices", "principal_vice", "strengths", "weaknesses", "technical_blocks", "emotional_blocks", "virtues", "skills", "attention_points", "action_plan", "emotional_map", "sales_risk_stages", "critical_stage", "discipline_scores"],
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
        try { dashboardData = JSON.parse(toolCall.function.arguments); } catch { console.error("Failed to parse"); }
      }
    }

    if (dashboardData) {
      dashboardData.disc = discScores;
      dashboardData.negotiation_score = negotiationScore;
    }

    return new Response(JSON.stringify({ analysis: { narrative: narrativeText, dashboard: dashboardData } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
