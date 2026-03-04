import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const metricType = formData.get("metric_type") as string;

    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo não enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const metricLabels: Record<string, string> = {
      conexoes: "Conexões enviadas",
      conexoes_aceitas: "Conexões aceitas",
      abordagens: "Abordagens/Mensagens enviadas",
    };

    const prompt = `Você é um parser de relatórios do Dripify (ferramenta de automação LinkedIn).

O usuário enviou um relatório do Dripify (pode ser PDF ou planilha Excel/CSV).
A métrica que interessa é: ${metricLabels[metricType] || metricType}

Extraia TODOS os leads/contatos do relatório que se relacionam com essa métrica.
Para cada lead encontrado, extraia:
- name: nome completo da pessoa
- linkedin: URL do perfil LinkedIn (se disponível)

Responda APENAS com um JSON válido no formato:
{
  "leads": [
    { "name": "Nome Completo", "linkedin": "https://linkedin.com/in/..." },
    { "name": "Outro Nome", "linkedin": "" }
  ],
  "total_found": 5,
  "metric_type": "${metricType}"
}

Se não conseguir extrair dados, retorne: { "leads": [], "total_found": 0, "error": "motivo" }`;

    // Use Gemini to parse the file
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type || "application/octet-stream"};base64,${base64Content}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Não foi possível extrair dados do relatório");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao processar relatório Dripify:", error);
    return new Response(
      JSON.stringify({ error: error.message, leads: [], total_found: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
