import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { submissionId, messages } = await req.json();

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: submission }, { data: answersData }, { data: knowledgeItems }] = await Promise.all([
      sb.from("test_submissions").select("*").eq("id", submissionId).single(),
      sb.from("test_answers").select("question_id, answer").eq("submission_id", submissionId).order("question_id"),
      sb.from("company_knowledge").select("title, content, category").eq("active", true),
    ]);

    const answersText = (answersData || []).map((a: any) => `Q${a.question_id}: ${a.answer}`).join("\n");
    const companyContext = (knowledgeItems || []).map((k: any) => `[${k.category}] ${k.title}: ${k.content}`).join("\n\n");

    const systemPrompt = `Você é um especialista em diagnóstico comportamental de vendedores/closers com profundo conhecimento em DISC, Eneagrama, psicologia de vendas e performance comercial.

Você está analisando as respostas do teste comportamental de: ${submission?.respondent_name || "Vendedor"}

RESPOSTAS DO TESTE:
${answersText}

${submission?.ai_analysis ? `ANÁLISE IA JÁ GERADA:\n${typeof submission.ai_analysis === "string" ? submission.ai_analysis : JSON.stringify(submission.ai_analysis)}` : ""}

${companyContext ? `CONTEXTO DA EMPRESA:\n${companyContext}` : ""}

Responda perguntas sobre este vendedor com base nas respostas acima. Seja direto, específico e use linguagem de gestor comercial.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sem resposta.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
