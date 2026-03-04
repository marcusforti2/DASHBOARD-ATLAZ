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

    const metricLabels: Record<string, string> = {
      conexoes: "Conexões enviadas",
      conexoes_aceitas: "Conexões aceitas",
      abordagens: "Abordagens/Mensagens enviadas",
    };

    const prompt = `Você é um parser de relatórios do Dripify (ferramenta de automação LinkedIn).

O usuário enviou um relatório do Dripify (pode ser PDF, planilha Excel/CSV, ou imagem/screenshot).
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

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    const fileType = file.type || "application/octet-stream";
    const fileName = file.name?.toLowerCase() || "";
    const isPdf = fileType === "application/pdf" || fileName.endsWith(".pdf");
    const isImage = fileType.startsWith("image/");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || 
                    fileType.includes("spreadsheet") || fileType.includes("excel");
    const isCsv = fileName.endsWith(".csv") || fileType === "text/csv";

    let messages: any[];

    if (isCsv) {
      // CSV: read as text directly
      const textContent = new TextDecoder().decode(uint8);
      messages = [
        {
          role: "user",
          content: `${prompt}\n\nConteúdo do arquivo CSV:\n\n${textContent}`,
        },
      ];
    } else if (isExcel) {
      // Excel: try to decode as text, if binary send as base64 with explanation
      let textContent = "";
      try {
        textContent = new TextDecoder("utf-8", { fatal: true }).decode(uint8);
      } catch {
        // Binary Excel - encode as base64 and ask AI to try
        const base64 = btoa(String.fromCharCode(...uint8));
        messages = [
          {
            role: "user",
            content: [
              { type: "text", text: `${prompt}\n\nO arquivo é um Excel (.xlsx/.xls). Aqui está o conteúdo em base64. Tente extrair os dados:` },
              {
                type: "image_url",
                image_url: { url: `data:${fileType};base64,${base64}` },
              },
            ],
          },
        ];
      }
      if (textContent) {
        messages = [
          {
            role: "user",
            content: `${prompt}\n\nConteúdo do arquivo:\n\n${textContent}`,
          },
        ];
      }
    } else {
      // PDF or Image: send as multimodal content
      const base64 = btoa(String.fromCharCode(...uint8));
      const mimeType = isPdf ? "application/pdf" : isImage ? fileType : "application/octet-stream";
      
      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ];
    }

    console.log(`Processing Dripify file: ${file.name}, type: ${fileType}, size: ${uint8.length}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI gateway error: ${aiResponse.status}`, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos.", leads: [], total_found: 0 }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na sua conta.", leads: [], total_found: 0 }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response content:", content.substring(0, 500));

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Não foi possível extrair dados do relatório. Tente enviar uma captura de tela (screenshot) do relatório.");
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
