import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { memberName, courseTitle, moduleTitle, lessons, deadline, driveFolders } = await req.json();

    const lessonsInfo = lessons.map((l: any, i: number) => {
      const driveLink = l.drive_folder_id ? `https://drive.google.com/drive/folders/${l.drive_folder_id}` : null;
      return `Aula ${i + 1}: "${l.title}" - ${l.description || "Sem descrição"}${driveLink ? ` | Pasta Drive: ${driveLink}` : ""}`;
    }).join("\n");

    const moduleDriveLink = driveFolders?.module ? `https://drive.google.com/drive/folders/${driveFolders.module}` : null;

    const systemPrompt = `Você é um gestor de treinamentos de equipes comerciais. Escreva uma mensagem de WhatsApp motivacional e profissional para um colaborador que foi ESCOLHIDO para liderar/gravar um treinamento.

A mensagem deve seguir esta estrutura:
1. ABERTURA MOTIVACIONAL - "Você foi escolhido(a) para liderar este treinamento!" - destacar a confiança depositada
2. CONTEXTO DO TREINAMENTO - O que é o curso, por que é importante, qual o impacto no time
3. SEU MÓDULO - Detalhar o módulo que ele vai gravar
4. AULAS PARA GRAVAR - Lista cada aula com:
   - Título da aula
   - O que abordar (resumo do conteúdo)
   - Dicas de gravação específicas
   - Link da pasta no Drive para envio do vídeo (se disponível)
5. COMO USAR O DRIVE - Explicar que cada aula tem sua própria pasta no Drive, basta gravar e fazer upload do vídeo na pasta correspondente. Incluir o link da pasta do módulo se disponível.
6. PRAZO - Se houver data limite, destacar de forma clara
7. CHECKLIST FINAL - Lista de tarefas objetivas (✅ Assistir o roteiro, ✅ Preparar cenário, ✅ Gravar cada aula, ✅ Subir no Drive, etc.)

REGRAS DE FORMATAÇÃO:
- Use formatação WhatsApp: *negrito*, _itálico_
- NÃO use markdown (##, ###, etc.)
- Use emojis de forma profissional
- Quebre em blocos com linhas separadoras (─── ou similar)
- Máximo 2500 caracteres
- Seja direto mas acolhedor e motivacional`;

    const userPrompt = `Nome do colaborador: ${memberName}
Curso: "${courseTitle}"
Módulo: "${moduleTitle || "Módulo único"}"
${deadline ? `Data limite para entrega: ${deadline}` : "Sem data limite definida"}
${moduleDriveLink ? `Pasta do módulo no Drive: ${moduleDriveLink}` : "Google Drive não configurado para este módulo"}

Aulas para gravar:
${lessonsInfo}

Gere a mensagem completa de WhatsApp.`;

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
        temperature: 0.5,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      throw new Error(`AI error: ${response.status} - ${t}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-script-message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
