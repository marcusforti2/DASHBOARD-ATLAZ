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

function calculateDiscScores(answersMap: Record<number, number>) {
  const scores: Record<string, number> = {};
  for (const [dim, ids] of Object.entries(DISC_QUESTIONS)) {
    const vals = ids.map(id => answersMap[id] || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    scores[dim] = Math.round((total / (ids.length * 5)) * 100);
  }
  return scores;
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

    // Parse answers to calculate DISC scores
    const answersMap: Record<number, number> = {};
    if (typeof answers === "string") {
      const lines = answers.split("\n");
      for (const line of lines) {
        const match = line.match(/Q(\d+):\s*(\d+)/);
        if (match) answersMap[parseInt(match[1])] = parseInt(match[2]);
      }
    } else if (typeof answers === "object") {
      for (const [k, v] of Object.entries(answers)) {
        answersMap[parseInt(k)] = parseInt(v as string);
      }
    }

    const discScores = calculateDiscScores(answersMap);
    const classification = classifySDR(discScores);

    const systemPrompt = `Você é um especialista em diagnóstico comportamental DISC aplicado a SDRs (Sales Development Representatives) de prospecção outbound.

${companyContext ? `CONTEXTO DA EMPRESA:\n${companyContext}\n\n` : ""}

DADOS DISC CALCULADOS:
- D (Dominância): ${discScores.D}%
- I (Influência): ${discScores.I}%
- S (Estabilidade): ${discScores.S}%
- C (Conformidade): ${discScores.C}%
- Perfil Dominante: ${classification.dominant} (${classification.classification.label})
- Perfil Secundário: ${classification.secondary} (${classification.secondaryClassification.label})

REGRAS DE FORMATAÇÃO:
- NUNCA cite números de questões ou referências como "(Q1: 4)"
- Escreva parágrafos bem estruturados
- Use linguagem direta e profissional de gestor comercial

SEÇÕES DO RELATÓRIO:

1. **PERFIL DISC DO SDR**
   Explique o perfil DISC com percentuais, dominante e secundário. Como esse perfil se manifesta na prospecção.

2. **CLASSIFICAÇÃO DO SDR**
   Classifique como: Hunter (D), Conversador (I), Executor (S) ou Analítico (C). Explique o que isso significa na prática.

3. **PONTOS FORTES NA PROSPECÇÃO**
   3-5 forças naturais desse perfil para prospecção outbound.

4. **PONTOS DE ATENÇÃO**
   3-5 riscos ou pontos cegos desse perfil que podem comprometer resultados.

5. **ESTILO NATURAL DE ABORDAGEM**
   Como esse SDR naturalmente aborda leads, conduz conversas e lida com objeções iniciais.

6. **RESILIÊNCIA E SUSTENTAÇÃO**
   Capacidade de manter ritmo, lidar com rejeição e manter disciplina ao longo do tempo.

7. **PLANO DE DESENVOLVIMENTO** (3-5 ações)
   Ações práticas e específicas para esse SDR melhorar sua performance.

8. **NÍVEL DE MATURIDADE COMO SDR** (1 a 10)
   Avaliação geral com justificativa.

${companyContext ? "9. **ALINHAMENTO COM A VISÃO DA EMPRESA**" : ""}

Seja direto, preciso e use linguagem de gestor comercial.`;

    const narrativeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise as seguintes respostas do teste DISC de um SDR de prospecção:\n\n${answers}` },
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

    const analysis = {
      narrative: narrativeText,
      dashboard: {
        disc: discScores,
        disc_dominante: classification.dominant,
        disc_secundario: classification.secondary,
        classification: classification.classification.label,
        classification_description: classification.classification.description,
        secondary_classification: classification.secondaryClassification.label,
        maturity_level: 0, // Will be extracted from narrative
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
