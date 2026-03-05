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

function classifySDR(scores: Record<string, number>) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0][0];
  const secondary = sorted[1][0];
  const classifications: Record<string, { label: string; description: string }> = {
    D: { label: "Hunter", description: "Perfil agressivo e orientado a resultados. Toma iniciativa, não tem medo de abordar e busca decisão rápida." },
    I: { label: "Conversador", description: "Perfil relacional e comunicativo. Cria conexões rápidas, adapta linguagem e transmite entusiasmo." },
    S: { label: "Executor", description: "Perfil consistente e resiliente. Mantém ritmo, lida bem com rejeição e sustenta disciplina." },
    C: { label: "Analítico", description: "Perfil metódico e organizado. Pesquisa antes de abordar, segue processos e busca melhoria contínua." },
  };
  return {
    dominant,
    secondary,
    classification: classifications[dominant],
    secondaryClassification: classifications[secondary],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { submissionId, answers } = await req.json();

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load company knowledge
    const { data: knowledgeItems } = await sb.from("company_knowledge").select("title, content, category").eq("active", true);
    const companyContext = (knowledgeItems || []).map((k: any) => `[${k.category}] ${k.title}: ${k.content}`).join("\n\n");

    // Parse answers to calculate scores
    const answersMap: Record<number, number> = {};
    if (typeof answers === "string") {
      const lines = answers.split("\n");
      for (const line of lines) {
        const match = line.match(/Q(\d+).*?Resposta:\s*(\d+)/);
        if (match) answersMap[parseInt(match[1])] = parseInt(match[2]);
      }
    } else if (typeof answers === "object") {
      for (const [k, v] of Object.entries(answers)) {
        const num = parseInt(v as string);
        if (!isNaN(num)) answersMap[parseInt(k)] = num;
      }
    }

    const discScores = calculateDiscScores(answersMap);
    const resilienceScore = calculateResilienceScore(answersMap);
    const classification = classifySDR(discScores);

    const systemPrompt = `Você é um especialista em diagnóstico comportamental DISC aplicado a SDRs (Sales Development Representatives) de prospecção outbound.

${companyContext ? `CONTEXTO DA EMPRESA:\n${companyContext}\n\n` : ""}

DADOS CALCULADOS:
- D (Dominância): ${discScores.D}%
- I (Influência): ${discScores.I}%
- S (Estabilidade): ${discScores.S}%
- C (Conformidade): ${discScores.C}%
- Perfil Dominante: ${classification.dominant} (${classification.classification.label})
- Perfil Secundário: ${classification.secondary} (${classification.secondaryClassification.label})
- Score de Resiliência: ${resilienceScore}%

O teste possui 120 perguntas divididas em:
- Bloco 1-4: DISC (40 perguntas escala 1-5)
- Bloco 5-8: Conhecimento, Estratégia, Rotina e Qualidade (40 perguntas abertas)
- Bloco 9: Pressão & Resiliência (15 escala 1-5)
- Bloco 10: Decisão Prática (15 múltipla escolha — cenários reais)
- Bloco 11: Maturidade Comercial (10 perguntas abertas)

REGRAS DE FORMATAÇÃO:
- NUNCA cite números de questões ou referências como "(Q1: 4)"
- Escreva parágrafos bem estruturados
- Use linguagem direta e profissional de gestor comercial
- Cruze as respostas dos diferentes blocos para identificar incoerências

SEÇÕES DO RELATÓRIO:

1. **PERFIL DISC DO SDR**
   Explique o perfil DISC com percentuais, dominante e secundário. Como esse perfil se manifesta na prospecção.

2. **CLASSIFICAÇÃO DO SDR**
   Classifique como: Hunter (D), Conversador (I), Executor (S) ou Analítico (C). Explique o que isso significa na prática.

3. **PONTOS FORTES NA PROSPECÇÃO**
   3-5 forças naturais baseadas no DISC e nas respostas práticas.

4. **PONTOS DE ATENÇÃO E RISCOS**
   3-5 riscos reais identificados cruzando respostas do DISC com cenários práticos e abertas.

5. **RESILIÊNCIA E PRESSÃO** (Score: ${resilienceScore}%)
   Análise profunda da capacidade de lidar com rejeição, pressão e frustração. Cruze escala + cenários + abertas.

6. **CONHECIMENTO TÉCNICO SOBRE SDR**
   Baseado nas respostas do Bloco 5-6, avalie o nível de conhecimento sobre a função, qualificação de leads e estratégia de abordagem.

7. **ROTINA E ORGANIZAÇÃO**
   Baseado no Bloco 7, avalie disciplina, organização e consistência na rotina.

8. **PADRÃO DE QUALIDADE**
   Baseado no Bloco 8, avalie se o SDR tem visão de qualidade, preparo e evolução.

9. **ESTILO NATURAL DE ABORDAGEM**
   Como esse SDR naturalmente aborda leads, conduz conversas e lida com objeções iniciais.

10. **RESILIÊNCIA E PRESSÃO** (Score: ${resilienceScore}%)
    Análise profunda cruzando Bloco 9 (escala) + Bloco 10 (cenários) + Bloco 11 (abertas).

11. **ANÁLISE DE MATURIDADE COMERCIAL**
    Baseado nas respostas abertas do Bloco 11, avalie maturidade, autoconhecimento e visão de longo prazo.

12. **INCOERÊNCIAS IDENTIFICADAS**
    Compare respostas de escala vs cenários vs abertas. Onde o discurso não bate com o comportamento?

13. **PLANO DE DESENVOLVIMENTO** (3-5 ações)
    Ações práticas e específicas para esse SDR melhorar.

14. **NÍVEL DE MATURIDADE COMO SDR** (1 a 10)
    Avaliação geral com justificativa.

15. **SCORE DE RISCO**
    - Risco de desistência (1-10)
    - Risco de baixa disciplina (1-10)
    - Risco de baixa resiliência (1-10)

${companyContext ? "16. **ALINHAMENTO COM A VISÃO DA EMPRESA**" : ""}

Seja direto, preciso e use linguagem de gestor comercial.`;

    const narrativeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise as seguintes respostas do teste comportamental completo de um SDR de prospecção (120 perguntas — DISC + Conhecimento/Rotina/Qualidade + Pressão/Resiliência/Maturidade):\n\n${answers}` },
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

    // Extract risk scores from narrative using structured output
    const riskResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extraia dados estruturados da análise de um SDR." },
          { role: "user", content: `Análise:\n${narrativeText}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_sdr_data",
            description: "Extrai scores e dados estruturados da análise do SDR.",
            parameters: {
              type: "object",
              properties: {
                maturity_level: { type: "number", description: "Nível de maturidade 1-10" },
                risk_dropout: { type: "number", description: "Risco de desistência 1-10" },
                risk_low_discipline: { type: "number", description: "Risco de baixa disciplina 1-10" },
                risk_low_resilience: { type: "number", description: "Risco de baixa resiliência 1-10" },
                selling_style: { type: "string", description: "Estilo de abordagem em uma frase" },
              },
              required: ["maturity_level", "risk_dropout", "risk_low_discipline", "risk_low_resilience", "selling_style"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_sdr_data" } },
        temperature: 0.2,
      }),
    });

    let riskData: any = {};
    if (riskResponse.ok) {
      const riskResult = await riskResponse.json();
      const toolCall = riskResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try { riskData = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
      }
    }

    const analysis = {
      narrative: narrativeText,
      dashboard: {
        disc: discScores,
        disc_dominante: classification.dominant,
        disc_secundario: classification.secondary,
        classification: classification.classification.label,
        classification_description: classification.classification.description,
        secondary_classification: classification.secondaryClassification.label,
        resilience_score: resilienceScore,
        maturity_level: riskData.maturity_level || 0,
        risk_dropout: riskData.risk_dropout || 0,
        risk_low_discipline: riskData.risk_low_discipline || 0,
        risk_low_resilience: riskData.risk_low_resilience || 0,
        selling_style: riskData.selling_style || "",
      },
    };

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
