import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente especialista em extrair dados de leads a partir de texto não-estruturado.

TAREFA: Analise o texto fornecido e extraia TODOS os leads encontrados.

Para cada lead, extraia:
- name: Nome completo da pessoa
- phone: Número de telefone (apenas dígitos, com DDD, sem +55)
- linkedin_url: URL do LinkedIn (se houver)

REGRAS:
1. Telefones podem estar em qualquer formato: (11) 99999-8888, 11999998888, +55 11 99999-8888, etc. Normalize para apenas dígitos com DDD.
2. Se o telefone não tiver DDD, tente inferir do contexto ou deixe como está.
3. URLs do LinkedIn podem ser completas ou parciais (linkedin.com/in/...).
4. Se não encontrar LinkedIn, retorne string vazia.
5. Ignore linhas que são claramente cabeçalhos, instruções ou texto irrelevante.
6. Seja generoso na extração — se parece um lead, extraia.

RESPONDA APENAS com JSON válido no formato:
{"leads": [{"name": "...", "phone": "...", "linkedin_url": "..."}, ...]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = { leads: [] };
    }

    const leads = (parsed.leads || []).map((l: any) => ({
      name: String(l.name || "").trim(),
      phone: String(l.phone || "").replace(/[^0-9]/g, ""),
      linkedin_url: String(l.linkedin_url || "").trim(),
    })).filter((l: any) => l.name && l.phone && l.phone.length >= 8);

    return new Response(JSON.stringify({ leads, count: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-lead-batch error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
