// No external serve import needed - using Deno.serve

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth guard ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, member_name, metrics, goals, behavioral_text, month_label } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "performance") {
      systemPrompt = `Você é um analista de vendas especializado em prospecção B2B. Analise a performance do SDR com base nas métricas fornecidas. Seja direto, use bullet points, identifique padrões, pontos fortes, fraquezas e dê recomendações acionáveis. Responda em português brasileiro.`;
      
      const metricsStr = Object.entries(metrics || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
      const goalsStr = goals ? Object.entries(goals).map(([k, v]) => `${k}: ${v}`).join("\n") : "Sem metas definidas";
      
      userPrompt = `Analise a performance individual do SDR "${member_name}" no mês "${month_label || 'atual'}":

MÉTRICAS REALIZADAS:
${metricsStr}

METAS DO MÊS:
${goalsStr}

Forneça:
1. **Resumo Geral** - nota de 0-10 e visão geral
2. **Pontos Fortes** - onde está performando bem
3. **Pontos de Atenção** - onde precisa melhorar
4. **Padrões Identificados** - tendências nos dados
5. **Plano de Ação** - 3-5 ações concretas para melhorar`;
    } else if (type === "behavioral") {
      systemPrompt = `Você é um analista comportamental de vendas. Recebeu o conteúdo extraído de um PDF de análise comportamental/DISC/perfil de personalidade de um SDR de vendas. Cruze essas informações com as métricas de performance para gerar insights acionáveis. Responda em português brasileiro.`;
      
      const metricsStr = metrics ? Object.entries(metrics).map(([k, v]) => `${k}: ${v}`).join("\n") : "Sem métricas disponíveis";
      
      userPrompt = `SDR: "${member_name}"

CONTEÚDO DO PDF COMPORTAMENTAL:
${behavioral_text}

MÉTRICAS DE PERFORMANCE:
${metricsStr}

Analise:
1. **Perfil Comportamental** - resumo do perfil identificado
2. **Relação Perfil x Performance** - como o perfil impacta nos números
3. **Dificuldades Previstas** - baseado no perfil, onde terá mais dificuldade
4. **Potenciais Não Explorados** - capacidades que não estão sendo usadas
5. **Recomendações Personalizadas** - ações adaptadas ao perfil comportamental
6. **Estilo de Gestão Ideal** - como o gestor deve abordar este SDR`;
    } else {
      throw new Error("Invalid analysis type");
    }

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
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-closer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
