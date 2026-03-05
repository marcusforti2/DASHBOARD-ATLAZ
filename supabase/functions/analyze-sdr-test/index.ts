import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISC_QUESTIONS: Record<string, number[]> = {
  D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  I: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  S: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  C: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
};
const RESILIENCE_QUESTIONS = [81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95];

function calculateDiscScores(answersMap: Record<number, number>) {
  const scores: Record<string, number> = {};
  for (const [dim, ids] of Object.entries(DISC_QUESTIONS)) {
    const vals = ids.map(id => answersMap[id] || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    scores[dim] = Math.round((total / (ids.length * 5)) * 100);
  }
  return scores;
}

function calculateResilienceScore(answersMap: Record<number, number>) {
  const vals = RESILIENCE_QUESTIONS.map(id => answersMap[id] || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  return Math.round((total / (RESILIENCE_QUESTIONS.length * 5)) * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { submissionId, answers } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: knowledgeItems } = await sb.from("company_knowledge").select("title, content, category").eq("active", true);
    const companyContext = (knowledgeItems || []).map((k: any) => `[${k.category}] ${k.title}: ${k.content}`).join("\n\n");

    const answersMap: Record<number, number> = {};
    if (typeof answers === "string") {
      for (const line of answers.split("\n")) {
        const match = line.match(/Q(\d+).*?Resposta:\s*(\d+)/);
        if (match) answersMap[parseInt(match[1])] = parseInt(match[2]);
      }
    }

    const discScores = calculateDiscScores(answersMap);
    const resilienceScore = calculateResilienceScore(answersMap);
    const sorted = Object.entries(discScores).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0][0];
    const secondary = sorted[1][0];

    const classLabels: Record<string, string> = { D: "Hunter", I: "Conversador", S: "Executor", C: "Analítico" };

    const systemPrompt = `Você é um especialista em diagnóstico comportamental DISC aplicado a SDRs de prospecção outbound.

${companyContext ? `CONTEXTO DA EMPRESA:\n${companyContext}\n\n` : ""}DADOS CALCULADOS:
- DISC: D=${discScores.D}%, I=${discScores.I}%, S=${discScores.S}%, C=${discScores.C}%
- Dominante: ${dominant} (${classLabels[dominant]}), Secundário: ${secondary} (${classLabels[secondary]})
- Score de Resiliência: ${resilienceScore}%

O teste possui 120 perguntas:
- Bloco 1-4: DISC (40 escala 1-5)
- Bloco 5-8: Conhecimento, Estratégia, Rotina, Qualidade (40 abertas)
- Bloco 9: Pressão & Resiliência (15 escala)
- Bloco 10: Decisão Prática (15 cenários)
- Bloco 11: Maturidade Comercial (10 abertas)

REGRAS: NUNCA cite números de questões. Linguagem de gestor comercial.

SEÇÕES:
1. **PERFIL DISC DO SDR**
2. **CLASSIFICAÇÃO** (Hunter/Conversador/Executor/Analítico)
3. **TENDÊNCIA COMPORTAMENTAL** — padrão dominante
4. **MAPA EMOCIONAL** — como emoções impactam a prospecção
5. **PONTOS FORTES** — forças naturais na prospecção
6. **PONTOS FRACOS** — onde perde performance
7. **VÍCIOS EMOCIONAIS** — padrões que sabotam abordagens
8. **TRAVAS TÉCNICAS** — gaps de conhecimento/processo de prospecção
9. **TRAVAS EMOCIONAIS** — bloqueios psicológicos (rejeição, medo, etc)
10. **FORÇAS E VIRTUDES** — qualidades naturais
11. **HABILIDADES DESENVOLVIDAS** — competências adquiridas
12. **SUPER PODER** — habilidade excepcional deste SDR
13. **NÍVEL DE EXECUÇÃO** (1-10) — consistência e ritmo
14. **MATURIDADE COMERCIAL** (1-10)
15. **RESILIÊNCIA E PRESSÃO** (Score: ${resilienceScore}%)
16. **TRAVAS DE PROSPECÇÃO** — onde trava no processo de prospecção
17. **PONTOS DE ATENÇÃO** — riscos que o gestor deve monitorar
18. **COMO POTENCIALIZAR** — 3-5 ações para maximizar resultado
${companyContext ? "19. **ALINHAMENTO COM A EMPRESA**" : ""}`;

    // 1) Narrative
    const narrativeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise as respostas do teste completo de SDR:\n\n${answers}` },
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

    // 2) Structured extraction
    const structuredResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extraia dados estruturados completos para dashboard visual de um SDR de prospecção." },
          { role: "user", content: `Análise:\n${narrativeText}\n\nDISC: D=${discScores.D}% I=${discScores.I}% S=${discScores.S}% C=${discScores.C}%, Resiliência=${resilienceScore}%\n\nExtraia todos os dados.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_sdr_dashboard",
            description: "Gera dados completos para dashboard visual do SDR.",
            parameters: {
              type: "object",
              properties: {
                disc: { type: "object", properties: { D: { type: "number" }, I: { type: "number" }, S: { type: "number" }, C: { type: "number" } }, required: ["D", "I", "S", "C"] },
                disc_dominante: { type: "string", enum: ["D", "I", "S", "C"] },
                disc_secundario: { type: "string", enum: ["D", "I", "S", "C"] },
                sdr_type: { type: "string", enum: ["Hunter", "Conversador", "Executor", "Analítico"] },
                tendency: { type: "string", description: "Tendência comportamental em 2-4 palavras" },
                resilience_score: { type: "number" },
                maturity_level: { type: "number" },
                execution_level: { type: "number" },
                super_power: { type: "string" },
                selling_style: { type: "string" },
                recovery_time: { type: "string" },
                emotional_vices: { type: "array", items: { type: "object", properties: { name: { type: "string" }, score: { type: "number" } }, required: ["name", "score"] } },
                principal_vice: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                technical_blocks: { type: "array", items: { type: "string" } },
                emotional_blocks: { type: "array", items: { type: "string" } },
                prospecting_blocks: { type: "array", items: { type: "string" }, description: "Travas específicas de prospecção" },
                virtues: { type: "array", items: { type: "string" } },
                skills: { type: "array", items: { type: "string" } },
                attention_points: { type: "array", items: { type: "string" } },
                action_plan: { type: "array", items: { type: "string" } },
                emotional_map: { type: "array", items: { type: "object", properties: { area: { type: "string" }, level: { type: "number" } }, required: ["area", "level"] } },
                sales_risk_stages: { type: "array", items: { type: "object", properties: { stage: { type: "string" }, risk: { type: "number" } }, required: ["stage", "risk"] } },
                critical_stage: { type: "string" },
                discipline_scores: { type: "array", items: { type: "object", properties: { name: { type: "string" }, score: { type: "number" } }, required: ["name", "score"] } },
                risk_dropout: { type: "number" },
                risk_low_discipline: { type: "number" },
                risk_low_resilience: { type: "number" },
              },
              required: ["disc", "disc_dominante", "disc_secundario", "sdr_type", "tendency", "resilience_score", "maturity_level", "execution_level", "super_power", "selling_style", "recovery_time", "emotional_vices", "principal_vice", "strengths", "weaknesses", "technical_blocks", "emotional_blocks", "prospecting_blocks", "virtues", "skills", "attention_points", "action_plan", "emotional_map", "sales_risk_stages", "critical_stage", "discipline_scores", "risk_dropout", "risk_low_discipline", "risk_low_resilience"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_sdr_dashboard" } },
        temperature: 0.2,
      }),
    });

    let dashboardData: any = null;
    if (structuredResponse.ok) {
      const structuredResult = await structuredResponse.json();
      const toolCall = structuredResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try { dashboardData = JSON.parse(toolCall.function.arguments); } catch { console.error("Failed to parse"); }
      }
    }

    // Override with calculated scores
    if (dashboardData) {
      dashboardData.disc = discScores;
      dashboardData.resilience_score = resilienceScore;
    } else {
      // Fallback
      dashboardData = {
        disc: discScores,
        disc_dominante: dominant,
        disc_secundario: secondary,
        sdr_type: classLabels[dominant],
        resilience_score: resilienceScore,
        maturity_level: 0,
        execution_level: 0,
        selling_style: "",
      };
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
