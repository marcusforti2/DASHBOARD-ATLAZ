import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description) throw new Error("Descrição é obrigatória");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch company knowledge to enrich AI context
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    let knowledgeContext = "";
    try {
      const { data: knowledge } = await sb
        .from("company_knowledge")
        .select("title, category, content")
        .eq("active", true)
        .limit(20);
      if (knowledge && knowledge.length > 0) {
        knowledgeContext = `\n\nCONTEXTO DA EMPRESA (use para personalizar o processo com dados reais da empresa - ICP, produtos, objeções, etc):\n${knowledge.map((k: any) => `- [${k.category}] ${k.title}: ${k.content}`).join("\n")}`;
      }
    } catch (e) { console.error("Knowledge fetch error:", e); }

    const systemPrompt = `Você é um especialista em criação de fluxogramas de processos empresariais. Gere um diagrama organizado e profissional.

IMPORTANTE: O layout deve ser HORIZONTAL (da esquerda para a direita). Use as coordenadas x para avançar horizontalmente e y para ramificações verticais.

Retorne APENAS um JSON válido (sem markdown, sem texto extra) com esta estrutura exata:
{
  "nodes": [...],
  "edges": [...]
}

Cada nó deve ter:
{
  "id": "node-1",
  "type": "processNode",
  "position": { "x": <número>, "y": <número> },
  "data": {
    "type": "<tipo>",
    "label": "<nome curto>",
    "descricao": "<descrição breve>",
    "responsavel": "<quem executa>"
  }
}

Cada edge deve ter:
{
  "id": "edge-<n>",
  "source": "<id_origem>",
  "target": "<id_destino>",
  "type": "processEdge",
  "data": { "label": "<opcional: Sim/Não para decisões>", "color": "<opcional: green/red>" }
}

REGRAS DE LAYOUT:
1. Fluxo horizontal: cada coluna (etapa) avança 320px no eixo X
2. Primeira coluna começa em x=100
3. Para fluxo linear: todos os nós com y=300 (centralizado)
4. Para decisões (bifurcações): o caminho "Sim" vai para y=150, o caminho "Não" vai para y=450
5. Após uma bifurcação convergir, volte para y=300
6. Mantenha espaçamento uniforme e simétrico
7. Nunca sobreponha nós - cada nó precisa de pelo menos 200px de distância vertical

TIPOS DISPONÍVEIS:
- Fluxo: inicio, fim, decisao, paralelo, condicional
- Operacional: etapa, tarefa_manual, tarefa_automatica, aprovacao, espera, revisao, validacao, qualificacao
- Comunicação: notificacao, email_processo, whatsapp_processo, formulario, reuniao, ligacao, chatbot
- Redes sociais: instagram, facebook, linkedin, youtube, tiktok
- Funil: lead_captura, lead_qualificacao, lead_nutrição, landing_page, pagina_vendas, checkout, upsell, downsell, remarketing, webinar, sequencia_email
- Integração: sistema, documento, api, banco_dados, webhook, crm_integracao, zapier, n8n, make
- Automação: automacao, trigger, acao_automatica, delay, split_ab, tag_lead, score_lead, mover_pipeline
- Documentação: nota, sla, checklist, contrato, proposta
- Financeiro: pagamento, faturamento, orcamento, cobranca, comissao
- Pessoas: cliente, equipe, lead, prospect
- Análise: metrica, relatorio, dashboard, analytics

REGRAS DE CONTEÚDO:
1. SEMPRE comece com tipo "inicio" e termine com "fim"
2. Use "decisao" para pontos de bifurcação - edges com labels "Sim"/"Não" e cores green/red
3. Labels curtos (máx 3 palavras)
4. Descrições claras e acionáveis
5. Inclua responsáveis realistas (ex: "SDR", "Closer", "Gestor", "Sistema")
6. Use entre 8 e 15 nós para um processo completo
7. Garanta que todo nó tenha pelo menos uma conexão`;

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
          { role: "user", content: `Crie um fluxograma de processo para: ${description}${knowledgeContext}` },
        ],
        temperature: 0.5,
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

    // Post-process: ensure horizontal layout with proper spacing
    const nodeMap = new Map();
    parsed.nodes.forEach((n: any) => nodeMap.set(n.id, n));

    // Build adjacency for topological sort
    const adj = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    parsed.nodes.forEach((n: any) => { adj.set(n.id, []); inDeg.set(n.id, 0); });
    parsed.edges.forEach((e: any) => {
      adj.get(e.source)?.push(e.target);
      inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
    });

    // BFS topological sort for horizontal levels
    const queue: string[] = [];
    parsed.nodes.forEach((n: any) => { if ((inDeg.get(n.id) || 0) === 0) queue.push(n.id); });

    const level = new Map<string, number>();
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      
      if (!level.has(id)) level.set(id, 0);
      const currentLevel = level.get(id)!;
      
      for (const child of (adj.get(id) || [])) {
        const childLevel = Math.max(level.get(child) || 0, currentLevel + 1);
        level.set(child, childLevel);
        const newInDeg = (inDeg.get(child) || 1) - 1;
        inDeg.set(child, newInDeg);
        if (newInDeg <= 0) queue.push(child);
      }
    }

    // Handle unvisited nodes
    parsed.nodes.forEach((n: any) => {
      if (!level.has(n.id)) level.set(n.id, 0);
    });

    // Group by level
    const levelGroups = new Map<number, string[]>();
    level.forEach((l, id) => {
      if (!levelGroups.has(l)) levelGroups.set(l, []);
      levelGroups.get(l)!.push(id);
    });

    // Assign positions: horizontal with centered vertical distribution
    const H_SPACING = 320;
    const V_SPACING = 180;
    const START_X = 100;
    const CENTER_Y = 300;

    levelGroups.forEach((ids, l) => {
      const totalHeight = (ids.length - 1) * V_SPACING;
      const startY = CENTER_Y - totalHeight / 2;
      ids.forEach((id, i) => {
        const node = nodeMap.get(id);
        if (node) {
          node.position = { x: START_X + l * H_SPACING, y: startY + i * V_SPACING };
        }
      });
    });

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
