import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, context } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Descreva a campanha (mínimo 5 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextBlock = context
      ? `\nCONTEXTO DA EMPRESA (fornecido pelo usuário — use para personalizar os emails):\n${context}\n`
      : '';

    const systemPrompt = `Você é um especialista em email marketing para equipes de vendas (SDRs e Closers).
Dado uma descrição de campanha e contexto da empresa, crie um fluxo de automação de emails completo.
${contextBlock}
IMPORTANTE: Retorne APENAS o JSON válido, sem markdown, sem explicações, sem blocos de código.

O JSON deve ter esta estrutura:
{
  "flowName": "Nome da campanha",
  "flowDescription": "Descrição curta",
  "triggerType": "new_member|manual|schedule",
  "audienceType": "all|sdrs|closers",
  "nodes": [
    {
      "type": "email",
      "subject": "Assunto do email",
      "body": "HTML do email completo"
    },
    {
      "type": "wait",
      "duration": 2,
      "unit": "days"
    }
  ]
}

ESTILO DOS EMAILS HTML - OBRIGATÓRIO:
- Design minimalista inspirado em Apple e Nubank
- Estrutura com max-width: 600px centralizada
- Fundo do body: #f5f5f7
- Card principal: #ffffff com border-radius: 16px e padding generoso (40px)
- Tipografia: font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Títulos grandes e bold (28-32px), corpo 16px, line-height: 1.6
- Cores de destaque: gradiente sutil (#6C63FF → #4F46E5) para CTAs
- Botões com border-radius: 12px, padding: 16px 32px, sem bordas
- Espaçamento generoso entre seções (32-40px)
- Sem imagens pesadas, foque em tipografia e whitespace
- Rodapé discreto com texto pequeno (#8e8e93)
- Ícones via emoji quando necessário
- Dividers sutis: 1px solid #e5e5ea

Variáveis dinâmicas disponíveis:
- {{nome}} - Nome do destinatário
- {{email}} - Email do destinatário
- {{role}} - Função (SDR/Closer)

Crie emails persuasivos, profissionais e com CTAs claros.
Se o contexto da empresa foi fornecido, USE-O para personalizar copy, referências a produtos, ICP e processos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Crie uma campanha de email marketing para: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let campaignData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      campaignData = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "IA retornou formato inválido. Tente reformular." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build nodes for ReactFlow
    const flowNodes: any[] = [{
      id: "trigger-1",
      type: "trigger",
      position: { x: 250, y: 50 },
      data: { label: "Gatilho", triggerType: campaignData.triggerType || "manual", config: {} },
    }];

    const flowEdges: any[] = [];
    let yPosition = 200;
    let previousNodeId = "trigger-1";

    campaignData.nodes?.forEach((node: any, index: number) => {
      const nodeId = `${node.type}-${index + 1}`;

      if (node.type === "email") {
        flowNodes.push({
          id: nodeId, type: "email",
          position: { x: 250, y: yPosition },
          data: { label: "Enviar Email", subject: node.subject, body: node.body, templateId: "" },
        });
      } else if (node.type === "wait") {
        flowNodes.push({
          id: nodeId, type: "wait",
          position: { x: 250, y: yPosition },
          data: { label: "Aguardar", duration: node.duration || 1, unit: node.unit || "days" },
        });
      }

      flowEdges.push({
        id: `e-${previousNodeId}-${nodeId}`,
        source: previousNodeId, target: nodeId,
        markerEnd: { type: "arrowclosed" },
      });

      previousNodeId = nodeId;
      yPosition += 150;
    });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: flowData, error: flowError } = await supabase
      .from("email_flows")
      .insert({
        name: campaignData.flowName || "Campanha IA",
        description: campaignData.flowDescription || prompt,
        nodes: flowNodes,
        edges: flowEdges,
        audience_type: campaignData.audienceType || "all",
        is_active: false,
      })
      .select()
      .single();

    if (flowError) throw flowError;

    return new Response(JSON.stringify({ success: true, flow: flowData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
