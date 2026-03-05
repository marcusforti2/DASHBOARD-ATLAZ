import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description) throw new Error("Descrição é obrigatória");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um especialista em criação de fluxos de processos. Dado uma descrição, gere um diagrama de processo como JSON.

Retorne APENAS um JSON válido (sem markdown) com esta estrutura:
{
  "nodes": [
    {
      "id": "node-1",
      "type": "processNode",
      "position": { "x": 250, "y": 0 },
      "data": {
        "type": "inicio",
        "label": "Início",
        "descricao": ""
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "processEdge"
    }
  ]
}

Tipos de nós disponíveis:
- Fluxo: inicio, fim, decisao, paralelo, conector, loop, condicional
- Operacional: etapa, tarefa_manual, tarefa_automatica, aprovacao, espera, revisao, validacao, verificacao, qualificacao, priorizacao
- Comunicação: notificacao, email_processo, whatsapp_processo, formulario, reuniao, ligacao, sms, chatbot
- Redes sociais: instagram, facebook, linkedin, twitter, youtube, tiktok
- Funil: lead_captura, lead_qualificacao, lead_nutrição, landing_page, pagina_vendas, checkout, upsell, downsell, remarketing, webinar, sequencia_email
- Integração: sistema, documento, assinatura, api, banco_dados, webhook, crm_integracao, erp, zapier, n8n, make
- Automação: automacao, trigger, acao_automatica, condicao_automacao, delay, split_ab, tag_lead, score_lead, mover_pipeline
- Documentação: nota, sla, responsavel_node, checklist, anexo, contrato, proposta
- Financeiro: pagamento, faturamento, orcamento, cobranca, reembolso, comissao
- Pessoas: cliente, fornecedor, equipe, lead, prospect, afiliado, influencer
- Análise: metrica, relatorio, dashboard, pixel, utm, analytics

Regras:
1. Sempre comece com "inicio" e termine com "fim"
2. Use "decisao" para bifurcações com labels nas edges (Sim/Não)
3. Posicione os nós verticalmente com ~120px de espaçamento
4. Para bifurcações, espalhe horizontalmente com ~250px
5. Adicione descrições úteis em cada nó
6. Use os tipos adequados para cada etapa
7. Inclua responsáveis quando relevante`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Crie um fluxo de processo para: ${description}` },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro na API de IA");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    const parsed = JSON.parse(jsonStr.trim());
    if (!parsed.nodes || !parsed.edges) throw new Error("Formato inválido");

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
