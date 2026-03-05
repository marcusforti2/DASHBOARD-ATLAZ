import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { prompt, category, fileContent } = await req.json();

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch existing knowledge for context
    const { data: existing } = await sb
      .from("company_knowledge")
      .select("title, category, content")
      .eq("active", true)
      .limit(20);

    const existingContext = existing?.length
      ? `\n\nCONHECIMENTOS JÁ CADASTRADOS (não repita):\n${existing.map(k => `- [${k.category}] ${k.title}`).join("\n")}`
      : "";

    const fileContext = fileContent
      ? `\n\nCONTEÚDO DO ARQUIVO ENVIADO:\n${fileContent}`
      : "";

    const systemPrompt = `Você é um especialista em estruturar bases de conhecimento para equipes comerciais.

O usuário vai fornecer informações (texto livre ou conteúdo de arquivo) e você deve gerar um item de conhecimento estruturado.

REGRAS:
- Retorne EXATAMENTE um JSON com os campos: title, content, category
- O title deve ser curto e descritivo (máx 60 chars)
- O content deve ser detalhado, organizado e útil para um vendedor
- A category deve ser uma dessas: general, product, process, objections, scripts, culture, icp, competitors
- ${category ? `Use a categoria "${category}" como preferência` : "Escolha a categoria mais adequada"}
- NÃO inclua markdown no JSON, apenas texto limpo
- Responda APENAS com o JSON, sem texto extra${existingContext}${fileContext}`;

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
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI error: ${response.status} - ${t}`);
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || "";

    // Clean JSON from markdown fences
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-knowledge error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
