import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages, tool, memberId } = await req.json();

    // Fetch company knowledge
    const { data: knowledge } = await supabase
      .from("company_knowledge")
      .select("title, content, category, file_name")
      .eq("active", true);

    // Fetch member info if provided
    let memberContext = "";
    if (memberId) {
      const { data: member } = await supabase
        .from("team_members")
        .select("name, member_role")
        .eq("id", memberId)
        .single();

      // Fetch recent metrics
      const { data: recentMetrics } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("member_id", memberId)
        .order("date", { ascending: false })
        .limit(7);

      // Fetch behavioral analysis
      const { data: analysis } = await supabase
        .from("closer_analyses")
        .select("ai_analysis, analysis_type")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (member) {
        memberContext = `\n\nPERFIL DO USUÁRIO:
- Nome: ${member.name}
- Função: ${member.member_role}`;
      }

      if (recentMetrics?.length) {
        memberContext += `\n\nMÉTRICAS RECENTES (últimos ${recentMetrics.length} dias):
${recentMetrics.map(m => `- ${m.date}: Conexões=${m.conexoes}, Aceitas=${m.conexoes_aceitas}, Abordagens=${m.abordagens}, InMail=${m.inmail}, Follow-up=${m.follow_up}, Lig.Agendada=${m.lig_agendada}, Lig.Realizada=${m.lig_realizada}, Reunião Ag.=${m.reuniao_agendada}, Reunião Re.=${m.reuniao_realizada}`).join("\n")}`;
      }

      if (analysis?.[0]?.ai_analysis) {
        memberContext += `\n\nANÁLISE COMPORTAMENTAL:
${analysis[0].ai_analysis}`;
      }
    }

    const knowledgeContext = knowledge?.length
      ? `\n\nBASE DE CONHECIMENTO DA EMPRESA:\n${knowledge.map(k => `[${k.category.toUpperCase()}] ${k.title}${k.file_name ? ` (fonte: ${k.file_name})` : ""}:\n${k.content}`).join("\n\n")}`
      : "";

    // Tool-specific system prompts
    const toolPrompts: Record<string, string> = {
      chat: `Você é o Coach IA da equipe comercial. Seu papel é ajudar SDRs e Closers a melhorarem seu desempenho com base em dados reais, perfil comportamental e conhecimento da empresa.

Seja direto, motivador e prático. Use dados concretos quando disponível. Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "call-analysis": `Você é um especialista em análise de calls de vendas. O usuário vai descrever ou transcrever uma ligação e você deve:
1. Dar uma nota de 0-10
2. Identificar pontos fortes
3. Identificar pontos de melhoria
4. Sugerir frases alternativas
5. Dar 3 dicas práticas

Seja construtivo e específico. Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "qualification-analysis": `Você é especialista em qualificação de leads B2B. Analise a ligação de qualificação descrita e:
1. Avalie se as perguntas BANT/GPCT foram feitas
2. Identifique informações que faltaram
3. Sugira perguntas adicionais
4. Dê uma nota de qualificação 0-10
5. Recomende próximos passos

Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "meeting-script": `Você é especialista em criar scripts de reunião de vendas personalizados. Com base nas informações fornecidas sobre o prospect/empresa, crie:
1. Abertura impactante (30 segundos)
2. Perguntas de discovery (5-7 perguntas)
3. Apresentação de valor personalizada
4. Tratamento de objeções comuns
5. Técnica de fechamento
6. Próximos passos

Formato profissional e prático. Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "linkedin-carousel": `Você é especialista em criar conteúdo viral para LinkedIn. Crie um carrossel com:
1. Slide de capa impactante (título + subtítulo)
2. 5-8 slides de conteúdo (cada um com título curto e 2-3 bullet points)
3. Slide final com CTA
4. Sugestão de caption para o post

Formato: indique claramente cada slide. Use linguagem que gera engajamento. Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "linkedin-comments": `Você é especialista em criar comentários estratégicos para posts no LinkedIn que geram visibilidade e conexões. Para cada post descrito, crie:
1. 3 opções de comentário (curto, médio, longo)
2. Cada um deve agregar valor, não apenas concordar
3. Inclua pergunta ou insight que gere discussão

Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "linkedin-posts": `Você é especialista em criar posts de frases impactantes para LinkedIn sobre vendas, prospecção e desenvolvimento comercial. Crie:
1. 5 opções de post de frase
2. Cada um com hashtags relevantes
3. Formato que gera engajamento (storytelling, provocação, insight)

Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "sales-score": `Você é analista de performance comercial. Com base nos dados disponíveis, analise e dê nota para:
1. Volume de atividades (0-10)
2. Consistência (0-10)
3. Taxa de conversão (0-10)
4. Qualidade do pipeline (0-10)
5. Nota geral (0-10)

Inclua análise detalhada e plano de ação. Responda em português brasileiro.${memberContext}${knowledgeContext}`,

      "followup-sticker": `Você é criativo em mensagens de follow-up divertidas e memoráveis. Crie:
1. 5 mensagens curtas e criativas para follow-up via WhatsApp
2. Cada uma com emoji relevante
3. Tom profissional mas descontraído
4. Que gerem resposta do prospect

Responda em português brasileiro.${memberContext}${knowledgeContext}`,
    };

    const systemPrompt = toolPrompts[tool || "chat"] || toolPrompts.chat;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
