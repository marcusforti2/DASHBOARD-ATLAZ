import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";
const MAX_TOOL_ROUNDS = 3;

// ── Tool definitions ──
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_team_members",
      description: "Lista todos os membros ativos da equipe com nome, função e status",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_member_metrics",
      description: "Busca métricas diárias de um membro específico por nome",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome (ou parte do nome) do membro" },
          days: { type: "number", description: "Dias para buscar (padrão: 7)" },
        },
        required: ["member_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_metrics_summary",
      description: "Resumo de métricas agregadas de TODA a equipe nos últimos N dias",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Dias para buscar (padrão: 7)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_goals",
      description: "Consulta metas mensais (de um membro específico ou globais)",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional, se vazio retorna todas)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ranking",
      description: "Ranking dos membros por uma métrica específica nos últimos N dias",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada", "lig_realizada", "reuniao_agendada", "reuniao_realizada"],
            description: "Métrica para ranquear",
          },
          days: { type: "number", description: "Dias para contabilizar (padrão: 30)" },
        },
        required: ["metric"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leads_summary",
      description: "Resumo de leads registrados por membro",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional)" },
          days: { type: "number", description: "Dias para buscar (padrão: 7)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_member_metrics",
      description: "Atualiza métricas diárias de um membro. Use apenas quando o admin pedir explicitamente para alterar dados.",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD (padrão: hoje)" },
          metrics: {
            type: "object",
            description: "Objeto com as métricas a atualizar (ex: {conexoes: 10, abordagens: 5})",
            properties: {
              conexoes: { type: "number" },
              conexoes_aceitas: { type: "number" },
              abordagens: { type: "number" },
              inmail: { type: "number" },
              follow_up: { type: "number" },
              numero: { type: "number" },
              lig_agendada: { type: "number" },
              lig_realizada: { type: "number" },
              reuniao_agendada: { type: "number" },
              reuniao_realizada: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        required: ["member_name", "metrics"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp_message",
      description: "Envia uma mensagem WhatsApp para um membro da equipe",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro" },
          message: { type: "string", description: "Texto da mensagem" },
        },
        required: ["member_name", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_page",
      description: "Navega para uma página específica do painel administrativo",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: ["dashboard", "team", "goals", "reports", "training", "calendars", "whatsapp", "knowledge", "dna-mapping", "settings", "popups", "processos"],
            description: "Nome da página",
          },
        },
        required: ["page"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Busca na base de conhecimento da empresa",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_training_info",
      description: "Lista cursos e treinamentos disponíveis",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
];

// ── Helpers ──
async function findMember(supabase: any, name: string) {
  const { data } = await supabase.from("team_members").select("id, name, member_role").eq("active", true);
  if (!data?.length) return null;
  const lower = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    data.find((m: any) => m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === lower) ||
    data.find((m: any) => m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lower)) ||
    null
  );
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ── Tool execution ──
async function executeTool(supabase: any, name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case "get_team_members": {
        const { data } = await supabase.from("team_members").select("id, name, member_role, active, avatar_url").eq("active", true);
        return { members: data?.map((m: any) => ({ name: m.name, role: m.member_role })) || [] };
      }

      case "get_member_metrics": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const since = daysAgo(args.days || 7);
        const { data } = await supabase
          .from("daily_metrics")
          .select("date, conexoes, conexoes_aceitas, abordagens, inmail, follow_up, numero, lig_agendada, lig_realizada, reuniao_agendada, reuniao_realizada")
          .eq("member_id", member.id)
          .gte("date", since)
          .order("date", { ascending: false });
        const totals: any = {};
        const metricKeys = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada", "lig_realizada", "reuniao_agendada", "reuniao_realizada"];
        for (const k of metricKeys) totals[k] = (data || []).reduce((s: number, m: any) => s + (m[k] || 0), 0);
        return { member: member.name, role: member.role, days: data?.length || 0, totals, daily: data?.slice(0, 5) || [] };
      }

      case "get_all_metrics_summary": {
        const since = daysAgo(args.days || 7);
        const { data: members } = await supabase.from("team_members").select("id, name, member_role").eq("active", true);
        const { data: metrics } = await supabase.from("daily_metrics").select("member_id, conexoes, conexoes_aceitas, abordagens, reuniao_agendada, reuniao_realizada, lig_realizada").gte("date", since);
        if (!members || !metrics) return { error: "Sem dados" };
        const summary = members.map((m: any) => {
          const mm = metrics.filter((x: any) => x.member_id === m.id);
          return {
            name: m.name,
            role: m.member_role,
            dias: mm.length,
            conexoes: mm.reduce((s: number, x: any) => s + x.conexoes, 0),
            abordagens: mm.reduce((s: number, x: any) => s + x.abordagens, 0),
            reuniao_agendada: mm.reduce((s: number, x: any) => s + x.reuniao_agendada, 0),
            reuniao_realizada: mm.reduce((s: number, x: any) => s + x.reuniao_realizada, 0),
          };
        });
        return { period: `últimos ${args.days || 7} dias`, summary };
      }

      case "get_monthly_goals": {
        let query = supabase.from("monthly_goals").select("*, months(label)").order("created_at", { ascending: false }).limit(20);
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          query = query.eq("member_id", member.id);
        }
        const { data } = await query;
        return { goals: data || [] };
      }

      case "get_ranking": {
        const since = daysAgo(args.days || 30);
        const { data: members } = await supabase.from("team_members").select("id, name, member_role").eq("active", true);
        const { data: metrics } = await supabase.from("daily_metrics").select(`member_id, ${args.metric}`).gte("date", since);
        if (!members || !metrics) return { error: "Sem dados" };
        const ranked = members
          .map((m: any) => ({
            name: m.name,
            role: m.member_role,
            total: metrics.filter((x: any) => x.member_id === m.id).reduce((s: number, x: any) => s + (x[args.metric] || 0), 0),
          }))
          .sort((a: any, b: any) => b.total - a.total);
        return { metric: args.metric, period: `últimos ${args.days || 30} dias`, ranking: ranked };
      }

      case "get_leads_summary": {
        const since = daysAgo(args.days || 7);
        let query = supabase.from("lead_entries").select("member_id, lead_name, metric_type, date, source").gte("date", since).order("date", { ascending: false });
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          query = query.eq("member_id", member.id);
        }
        const { data, count } = await query.limit(50);
        return { total: data?.length || 0, leads: data || [] };
      }

      case "update_member_metrics": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const date = args.date || new Date().toISOString().split("T")[0];
        const d = new Date(date);
        const { data: month } = await supabase.from("months").select("id").eq("month", d.getMonth() + 1).eq("year", d.getFullYear()).single();
        if (!month) return { error: `Mês ${d.getMonth() + 1}/${d.getFullYear()} não cadastrado no sistema` };
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const { data: existing } = await supabase.from("daily_metrics").select("id").eq("member_id", member.id).eq("date", date).single();
        if (existing) {
          await supabase.from("daily_metrics").update(args.metrics).eq("id", existing.id);
        } else {
          await supabase.from("daily_metrics").insert({ member_id: member.id, month_id: month.id, date, day_of_week: dayNames[d.getDay()], ...args.metrics });
        }
        // Log as admin edit
        await supabase.from("lead_entries").insert({ member_id: member.id, lead_name: `[JARVIS] Edição de métricas ${date}`, source: "admin", metric_type: "edit" });
        return { success: true, message: `Métricas de ${member.name} atualizadas em ${date}`, updated: args.metrics };
      }

      case "send_whatsapp_message": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const { data: contact } = await supabase.from("whatsapp_contacts").select("phone").eq("team_member_id", member.id).eq("active", true).single();
        if (!contact) return { error: `${member.name} não tem WhatsApp cadastrado` };
        const instanceId = Deno.env.get("ULTRAMSG_INSTANCE_ID");
        const token = Deno.env.get("ULTRAMSG_TOKEN");
        if (!instanceId || !token) return { error: "WhatsApp não configurado no sistema" };
        const waResp = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, to: contact.phone, body: args.message }),
        });
        const waResult = await waResp.json();
        return { success: true, message: `Mensagem enviada para ${member.name} (${contact.phone})`, result: waResult };
      }

      case "navigate_to_page": {
        const pageNames: Record<string, string> = {
          dashboard: "Dashboard", team: "Equipe", goals: "Metas", reports: "Relatórios IA",
          training: "Treinamentos", calendars: "Agendas", whatsapp: "WhatsApp",
          knowledge: "Conhecimento IA", "dna-mapping": "Sales DNA", settings: "Configurações",
          popups: "Popups", processos: "Processos",
        };
        return { action: "navigate", page: args.page, label: pageNames[args.page] || args.page, marker: `[NAVIGATE:${args.page}]` };
      }

      case "search_knowledge_base": {
        const { data } = await supabase.from("company_knowledge").select("title, content, category, file_name").eq("active", true);
        if (!data?.length) return { results: [], message: "Base de conhecimento vazia" };
        const lower = (args.query || "").toLowerCase();
        const filtered = data.filter((k: any) => k.title.toLowerCase().includes(lower) || k.content.toLowerCase().includes(lower) || k.category.toLowerCase().includes(lower));
        return { results: (filtered.length ? filtered : data).slice(0, 5).map((k: any) => ({ title: k.title, category: k.category, excerpt: k.content.substring(0, 300), file: k.file_name })) };
      }

      case "get_training_info": {
        const { data: courses } = await supabase.from("training_courses").select("title, description, target_role, published, sort_order").eq("active", true).order("sort_order");
        return { courses: courses || [] };
      }

      default:
        return { error: `Ferramenta "${name}" não reconhecida` };
    }
  } catch (e) {
    console.error(`Tool ${name} error:`, e);
    return { error: `Erro ao executar ${name}: ${e.message || e}` };
  }
}

// ── System prompt ──
const SYSTEM_PROMPT = `Você é o JARVIS, assistente de voz para gestores de vendas. Respostas por VOZ — seja ULTRA CONCISO.

REGRAS DE RESPOSTA:
- Máximo 2-3 frases curtas por padrão
- Só expanda se o admin pedir "detalhe", "mais info", "explica melhor"
- Sem títulos, sem listas longas, sem markdown pesado
- Use números diretos: "João fez 15 conexões, 3 reuniões"
- Emojis: máximo 1 por resposta
- NUNCA repita o que o admin disse

CAPACIDADES (use ferramentas sempre que precisar de dados):
- Métricas, metas, ranking, leads, equipe
- Atualizar métricas, enviar WhatsApp
- Navegar páginas (use [NAVIGATE:page])
- Base de conhecimento, treinamentos

NAVEGAÇÃO: use navigate_to_page + marcador [NAVIGATE:page]
AÇÕES DESTRUTIVAS: confirme antes, exceto se explícito.
Responda SEMPRE em pt-BR.

MÉTRICAS: SDR (Conexões, Aceitas, Abordagens, InMail, Follow-up, Número, Lig.Agendada) | Closer (Lig.Realizada, Reunião Agendada/Realizada)
PÁGINAS: dashboard, team, goals, reports, training, calendars, whatsapp, knowledge, dna-mapping, settings, popups, processos`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { messages } = await req.json();

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // Build conversation with system prompt
    let currentMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.filter((m: any) => m.role !== "system"),
    ];

    // ── Tool calling loop ──
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch(GATEWAY, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({ model: MODEL, messages: currentMessages, tools: TOOLS }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      if (!choice) throw new Error("No choice in AI response");

      const assistantMsg = choice.message;
      const toolCalls = assistantMsg.tool_calls;

      // No tool calls → we have the final answer
      if (!toolCalls?.length) {
        // Convert to SSE format and return
        const content = assistantMsg.content || "";
        const sseChunks = [];
        // Split into small chunks for smooth streaming feel
        const chunkSize = 8;
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.slice(i, i + chunkSize);
          sseChunks.push(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
        }
        sseChunks.push("data: [DONE]\n\n");
        return new Response(sseChunks.join(""), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Execute tool calls
      currentMessages.push(assistantMsg);
      console.log(`Round ${round + 1}: executing ${toolCalls.length} tool(s):`, toolCalls.map((tc: any) => tc.function.name).join(", "));

      for (const tc of toolCalls) {
        let toolArgs = {};
        try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
        const toolResult = await executeTool(supabase, tc.function.name, toolArgs);
        currentMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    // After max rounds, do a final streaming call without tools
    const finalResponse = await fetch(GATEWAY, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ model: MODEL, messages: currentMessages, stream: true }),
    });

    if (!finalResponse.ok) {
      const t = await finalResponse.text();
      console.error("Final streaming error:", finalResponse.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar resposta final" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("jarvis-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
