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

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Descreva a campanha (mínimo 5 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em email marketing para equipes de vendas (SDRs e Closers).
Dado uma descrição de campanha, crie um fluxo de automação de emails completo.

IMPORTANTE: Retorne APENAS o JSON válido, sem markdown, sem explicações.

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
      "body": "Corpo do email em HTML simples. Use variáveis dinâmicas."
    },
    {
      "type": "wait",
      "duration": 2,
      "unit": "days"
    }
  ]
}

Variáveis dinâmicas disponíveis:
- {{nome}} - Nome do membro
- {{email}} - Email do membro
- {{role}} - Função (SDR/Closer)
- {{metricas_hoje}} - Métricas do dia
- {{progresso_meta}} - Progresso vs meta

Crie emails persuasivos, motivacionais e profissionais. Use técnicas de copywriting.
Os emails devem ter CTAs claros e criar conexão emocional.`;

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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
