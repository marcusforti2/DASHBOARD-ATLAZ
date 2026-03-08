import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const MAX_TOOL_ROUNDS = 5;

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
      description: "Busca métricas diárias de um membro específico por nome. Pode filtrar por mês/ano ou por número de dias.",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome (ou parte do nome) do membro" },
          days: { type: "number", description: "Dias para buscar (padrão: 30). Use para consultas relativas como 'últimos 7 dias'" },
          month: { type: "number", description: "Mês (1-12). Use quando o admin pedir um mês específico, ex: 'janeiro' = 1" },
          year: { type: "number", description: "Ano (ex: 2025, 2026). Se não informado, usa o ano atual" },
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
      description: "Resumo de métricas agregadas de TODA a equipe. Pode filtrar por mês/ano ou por dias.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Dias para buscar (padrão: 30)" },
          month: { type: "number", description: "Mês (1-12) para filtrar" },
          year: { type: "number", description: "Ano (ex: 2025, 2026)" },
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
      name: "get_weekly_goals",
      description: "Consulta metas semanais de um membro ou globais",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional)" },
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
      name: "send_whatsapp_to_phone",
      description: "Envia uma mensagem WhatsApp para qualquer número de telefone",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Número do telefone (ex: 5511999999999)" },
          message: { type: "string", description: "Texto da mensagem" },
        },
        required: ["phone", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_page",
      description: "Navega para uma página específica do sistema. Use sempre que o admin pedir para abrir/ir/mostrar qualquer página.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: ["dashboard", "team", "goals", "reports", "training", "calendars", "whatsapp", "knowledge", "dna-mapping", "settings", "popups", "processos", "closer-entry", "playbooks"],
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
      name: "inspect_member",
      description: "Abre a tela do sistema como se fosse o membro especificado (modo inspeção). Permite ao admin ver exatamente o que o SDR/Closer vê.",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro para inspecionar" },
        },
        required: ["member_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "filter_dashboard",
      description: "Filtra o dashboard por membro e/ou mês específico. Navega ao dashboard e aplica o filtro automaticamente.",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro para filtrar (opcional)" },
          month: { type: "number", description: "Mês (1-12) para filtrar (opcional)" },
          year: { type: "number", description: "Ano (opcional)" },
        },
        required: [],
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
      description: "Lista cursos, módulos e aulas de treinamento disponíveis",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_playbooks",
      description: "Lista playbooks de treinamento disponíveis, com filtro opcional por categoria ou role",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Categoria (opcional)" },
          role: { type: "string", description: "Role alvo: sdr, closer, all (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_playbook",
      description: "Cria um novo playbook de treinamento",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do playbook" },
          content: { type: "string", description: "Conteúdo em markdown" },
          description: { type: "string", description: "Descrição curta (opcional)" },
          category: { type: "string", description: "Categoria: geral, prospecção, qualificação, fechamento, pós-venda (padrão: geral)" },
          target_role: { type: "string", description: "Role alvo: sdr, closer, all (padrão: all)" },
          is_published: { type: "boolean", description: "Publicar imediatamente (padrão: false)" },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_popups",
      description: "Lista popups motivacionais cadastrados",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_popup",
      description: "Cria um novo popup motivacional",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do popup" },
          message: { type: "string", description: "Mensagem do popup" },
          emoji: { type: "string", description: "Emoji (ex: 🔥)" },
          category: { type: "string", description: "Categoria: motivation, tip, challenge" },
          target_role: { type: "string", description: "Role alvo: sdr, closer, all" },
        },
        required: ["title", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_popup",
      description: "Ativa ou desativa um popup motivacional pelo título ou ID",
      parameters: {
        type: "object",
        properties: {
          popup_title: { type: "string", description: "Título (ou parte do título) do popup" },
          active: { type: "boolean", description: "true para ativar, false para desativar" },
        },
        required: ["popup_title", "active"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_popup",
      description: "Deleta um popup motivacional pelo título",
      parameters: {
        type: "object",
        properties: {
          popup_title: { type: "string", description: "Título (ou parte do título) do popup" },
        },
        required: ["popup_title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_whatsapp_automations",
      description: "Lista automações de WhatsApp cadastradas",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_whatsapp_automation",
      description: "Ativa ou desativa uma automação de WhatsApp",
      parameters: {
        type: "object",
        properties: {
          automation_name: { type: "string", description: "Nome (ou parte do nome) da automação" },
          active: { type: "boolean", description: "true para ativar, false para desativar" },
        },
        required: ["automation_name", "active"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_processes",
      description: "Lista processos/fluxos salvos no editor de processos",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_closer_analyses",
      description: "Lista análises de closer (behaviorais, ligações) por membro",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dna_submissions",
      description: "Lista submissões de testes DNA (closer/sdr) com análise IA",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional)" },
          test_type: { type: "string", description: "Tipo: closer, sdr (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_reports",
      description: "Lista relatórios IA gerados",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_knowledge",
      description: "Cria um novo item na base de conhecimento da empresa",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do conhecimento" },
          content: { type: "string", description: "Conteúdo" },
          category: { type: "string", description: "Categoria: general, product, process, objection, scripts, culture, icp, competitors" },
        },
        required: ["title", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_knowledge",
      description: "Atualiza um item existente na base de conhecimento",
      parameters: {
        type: "object",
        properties: {
          title_search: { type: "string", description: "Título (ou parte) do item para encontrar" },
          new_title: { type: "string", description: "Novo título (opcional)" },
          new_content: { type: "string", description: "Novo conteúdo (opcional)" },
          new_category: { type: "string", description: "Nova categoria (opcional)" },
          active: { type: "boolean", description: "Ativar/desativar (opcional)" },
        },
        required: ["title_search"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_knowledge",
      description: "Deleta um item da base de conhecimento",
      parameters: {
        type: "object",
        properties: {
          title_search: { type: "string", description: "Título (ou parte) do item para deletar" },
        },
        required: ["title_search"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Lista eventos da agenda/calendário dos próximos dias",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Próximos N dias (padrão: 7)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_whatsapp_contacts",
      description: "Lista contatos WhatsApp cadastrados da equipe",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_course_publish",
      description: "Publica ou despublica um curso de treinamento",
      parameters: {
        type: "object",
        properties: {
          course_title: { type: "string", description: "Título (ou parte) do curso" },
          published: { type: "boolean", description: "true para publicar, false para despublicar" },
        },
        required: ["course_title", "published"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deactivate_team_member",
      description: "Desativa um membro da equipe (não deleta, apenas marca como inativo)",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro para desativar" },
        },
        required: ["member_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reactivate_team_member",
      description: "Reativa um membro da equipe que estava inativo",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro para reativar" },
        },
        required: ["member_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_monthly_goals",
      description: "Define ou atualiza metas mensais para um membro ou globais",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional, se vazio = meta global)" },
          month: { type: "number", description: "Mês (1-12)" },
          year: { type: "number", description: "Ano" },
          goals: {
            type: "object",
            description: "Metas a definir",
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
        required: ["month", "year", "goals"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_admin_invites",
      description: "Lista convites de administrador pendentes e usados",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_tool_usage",
      description: "Mostra estatísticas de uso das ferramentas de IA por membro",
      parameters: {
        type: "object",
        properties: {
          member_name: { type: "string", description: "Nome do membro (opcional)" },
          days: { type: "number", description: "Dias para buscar (padrão: 30)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_test_links",
      description: "Lista links de testes DNA (SDR/Closer) criados",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_training_notifications",
      description: "Lista notificações de treinamento enviadas",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
  },
];

// ── Helpers ──
async function findMember(supabase: any, name: string, includeInactive = false) {
  let query = supabase.from("team_members").select("id, name, member_role, active");
  if (!includeInactive) query = query.eq("active", true);
  const { data } = await query;
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

async function findByTitle(supabase: any, table: string, titleSearch: string, titleColumn = "title") {
  const { data } = await supabase.from(table).select("*");
  if (!data?.length) return null;
  const lower = titleSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    data.find((r: any) => r[titleColumn]?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === lower) ||
    data.find((r: any) => r[titleColumn]?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lower)) ||
    null
  );
}

async function getOrCreateMonth(supabase: any, month: number, year: number) {
  const { data: existing } = await supabase.from("months").select("id").eq("month", month).eq("year", year).single();
  if (existing) return existing.id;
  const monthNames = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const label = `${monthNames[month]} ${year}`;
  const { data: created, error } = await supabase.from("months").insert({ month, year, label }).select("id").single();
  if (error) return null;
  return created.id;
}

// ── Tool execution ──
async function executeTool(supabase: any, name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case "get_team_members": {
        const { data } = await supabase.from("team_members").select("id, name, member_role, active, avatar_url").eq("active", true);
        return { members: data?.map((m: any) => ({ id: m.id, name: m.name, role: m.member_role })) || [] };
      }

      case "get_member_metrics": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        
        let query = supabase
          .from("daily_metrics")
          .select("date, conexoes, conexoes_aceitas, abordagens, inmail, follow_up, numero, lig_agendada, lig_realizada, reuniao_agendada, reuniao_realizada")
          .eq("member_id", member.id);
        
        if (args.month) {
          const year = args.year || new Date().getFullYear();
          const startDate = `${year}-${String(args.month).padStart(2, '0')}-01`;
          const endMonth = args.month === 12 ? 1 : args.month + 1;
          const endYear = args.month === 12 ? year + 1 : year;
          const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
          query = query.gte("date", startDate).lt("date", endDate);
        } else {
          query = query.gte("date", daysAgo(args.days || 30));
        }
        
        const { data } = await query.order("date", { ascending: false });
        const metricKeys = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada", "lig_realizada", "reuniao_agendada", "reuniao_realizada"];
        const totals: any = {};
        for (const k of metricKeys) totals[k] = (data || []).reduce((s: number, m: any) => s + (m[k] || 0), 0);
        return { member: member.name, role: member.member_role, days_found: data?.length || 0, totals, daily: data?.slice(0, 10) || [] };
      }

      case "get_all_metrics_summary": {
        const { data: members } = await supabase.from("team_members").select("id, name, member_role").eq("active", true);
        let metricsQuery = supabase.from("daily_metrics").select("member_id, conexoes, conexoes_aceitas, abordagens, inmail, follow_up, numero, lig_agendada, lig_realizada, reuniao_agendada, reuniao_realizada");
        if (args.month) {
          const year = args.year || new Date().getFullYear();
          const startDate = `${year}-${String(args.month).padStart(2, '0')}-01`;
          const endMonth = args.month === 12 ? 1 : args.month + 1;
          const endYear = args.month === 12 ? year + 1 : year;
          const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
          metricsQuery = metricsQuery.gte("date", startDate).lt("date", endDate);
        } else {
          metricsQuery = metricsQuery.gte("date", daysAgo(args.days || 30));
        }
        const { data: metrics } = await metricsQuery;
        if (!members || !metrics) return { error: "Sem dados" };
        const summary = members.map((m: any) => {
          const mm = metrics.filter((x: any) => x.member_id === m.id);
          const metricKeys = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada", "lig_realizada", "reuniao_agendada", "reuniao_realizada"];
          const totals: any = { name: m.name, role: m.member_role, dias: mm.length };
          for (const k of metricKeys) totals[k] = mm.reduce((s: number, x: any) => s + (x[k] || 0), 0);
          return totals;
        });
        return { period: args.month ? `mês ${args.month}/${args.year || new Date().getFullYear()}` : `últimos ${args.days || 30} dias`, summary };
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
        const { data } = await query.limit(50);
        return { total: data?.length || 0, leads: data || [] };
      }

      case "update_member_metrics": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const date = args.date || new Date().toISOString().split("T")[0];
        const d = new Date(date);
        const monthId = await getOrCreateMonth(supabase, d.getMonth() + 1, d.getFullYear());
        if (!monthId) return { error: `Não foi possível criar/encontrar mês ${d.getMonth() + 1}/${d.getFullYear()}` };
        const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const { data: existing } = await supabase.from("daily_metrics").select("id").eq("member_id", member.id).eq("date", date).single();
        if (existing) {
          await supabase.from("daily_metrics").update(args.metrics).eq("id", existing.id);
        } else {
          await supabase.from("daily_metrics").insert({ member_id: member.id, month_id: monthId, date, day_of_week: dayNames[d.getDay()], ...args.metrics });
        }
        await supabase.from("lead_entries").insert({ member_id: member.id, lead_name: `[JARVIS] Edição de métricas ${date}`, source: "admin", metric_type: "edit" });
        return { success: true, message: `Métricas de ${member.name} atualizadas em ${date}`, updated: args.metrics };
      }

      case "send_whatsapp_message": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const { data: contact } = await supabase.from("whatsapp_contacts").select("phone").eq("team_member_id", member.id).eq("active", true).single();
        if (!contact) return { error: `${member.name} não tem WhatsApp cadastrado` };
        return await sendZapiMessage(contact.phone, args.message, member.name);
      }

      case "send_whatsapp_to_phone": {
        return await sendZapiMessage(args.phone, args.message);
      }

      case "navigate_to_page": {
        const pageNames: Record<string, string> = {
          dashboard: "Dashboard", team: "Equipe", goals: "Metas", reports: "Relatórios IA",
          training: "Treinamentos", calendars: "Agendas", whatsapp: "WhatsApp",
          knowledge: "Conhecimento IA", "dna-mapping": "Sales DNA", settings: "Configurações",
          popups: "Popups", processos: "Processos", "closer-entry": "Registro Closer",
          playbooks: "Playbooks",
        };
        return { action: "navigate", page: args.page, label: pageNames[args.page] || args.page, marker: `[ACTION:navigate:${args.page}]` };
      }

      case "inspect_member": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        return { action: "inspect", member: member.name, member_id: member.id, marker: `[ACTION:inspect:${member.id}]` };
      }

      case "filter_dashboard": {
        let memberId = "";
        let memberName = "";
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          memberId = member.id;
          memberName = member.name;
        }
        const filterValue = [memberId, args.month || "", args.year || ""].join("|");
        return { 
          action: "filter", 
          member: memberName || "todos", 
          month: args.month, 
          year: args.year,
          marker: `[ACTION:navigate:dashboard][ACTION:filter:${filterValue}]` 
        };
      }

      case "search_knowledge_base": {
        const { data } = await supabase.from("company_knowledge").select("title, content, category, file_name").eq("active", true);
        if (!data?.length) return { results: [], message: "Base de conhecimento vazia" };
        const lower = (args.query || "").toLowerCase();
        const filtered = data.filter((k: any) => k.title.toLowerCase().includes(lower) || k.content.toLowerCase().includes(lower) || k.category.toLowerCase().includes(lower));
        return { results: (filtered.length ? filtered : data).slice(0, 5).map((k: any) => ({ title: k.title, category: k.category, excerpt: k.content.substring(0, 300), file: k.file_name })) };
      }

      case "get_training_info": {
        const { data: courses } = await supabase.from("training_courses").select("id, title, description, target_role, published, sort_order").eq("active", true).order("sort_order");
        const { data: modules } = await supabase.from("training_modules").select("title, course_id, sort_order").order("sort_order");
        const { data: lessons } = await supabase.from("training_lessons").select("title, module_id, video_type, duration_seconds, sort_order").order("sort_order");
        return { courses: courses || [], modules_count: modules?.length || 0, lessons_count: lessons?.length || 0 };
      }

      case "get_playbooks": {
        let query = supabase.from("training_playbooks").select("id, title, description, category, target_role, is_published, created_at");
        if (args.category) query = query.eq("category", args.category);
        if (args.role) query = query.eq("target_role", args.role);
        const { data } = await query.order("created_at", { ascending: false });
        return { playbooks: data || [] };
      }

      case "create_playbook": {
        const { data, error } = await supabase.from("training_playbooks").insert({
          title: args.title,
          content: args.content,
          description: args.description || "",
          category: args.category || "geral",
          target_role: args.target_role || "all",
          is_published: args.is_published || false,
        }).select().single();
        if (error) return { error: error.message };
        return { success: true, playbook: { id: data.id, title: data.title } };
      }

      case "get_popups": {
        const { data } = await supabase.from("motivational_popups").select("id, title, message, emoji, category, target_role, active, frequency_minutes").order("created_at", { ascending: false });
        return { popups: data || [] };
      }

      case "create_popup": {
        const { data, error } = await supabase.from("motivational_popups").insert({
          title: args.title,
          message: args.message,
          emoji: args.emoji || "🔥",
          category: args.category || "motivation",
          target_role: args.target_role || "all",
        }).select().single();
        if (error) return { error: error.message };
        return { success: true, popup: data };
      }

      case "toggle_popup": {
        const popup = await findByTitle(supabase, "motivational_popups", args.popup_title);
        if (!popup) return { error: `Popup "${args.popup_title}" não encontrado` };
        const { error } = await supabase.from("motivational_popups").update({ active: args.active }).eq("id", popup.id);
        if (error) return { error: error.message };
        return { success: true, message: `Popup "${popup.title}" ${args.active ? "ativado" : "desativado"}` };
      }

      case "delete_popup": {
        const popup = await findByTitle(supabase, "motivational_popups", args.popup_title);
        if (!popup) return { error: `Popup "${args.popup_title}" não encontrado` };
        const { error } = await supabase.from("motivational_popups").delete().eq("id", popup.id);
        if (error) return { error: error.message };
        return { success: true, message: `Popup "${popup.title}" deletado` };
      }

      case "get_whatsapp_automations": {
        const { data } = await supabase.from("whatsapp_automations").select("id, name, description, active, target_audience, target_role, schedule_cron").order("created_at", { ascending: false });
        return { automations: data || [] };
      }

      case "toggle_whatsapp_automation": {
        const automation = await findByTitle(supabase, "whatsapp_automations", args.automation_name, "name");
        if (!automation) return { error: `Automação "${args.automation_name}" não encontrada` };
        const { error } = await supabase.from("whatsapp_automations").update({ active: args.active }).eq("id", automation.id);
        if (error) return { error: error.message };
        return { success: true, message: `Automação "${automation.name}" ${args.active ? "ativada" : "desativada"}` };
      }

      case "get_processes": {
        const { data } = await supabase.from("process_flows").select("id, name, description, is_public, created_at").order("created_at", { ascending: false });
        return { processes: data || [] };
      }

      case "get_closer_analyses": {
        let query = supabase.from("closer_analyses").select("id, member_id, file_name, analysis_type, ai_analysis, created_at");
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          query = query.eq("member_id", member.id);
        }
        const { data } = await query.order("created_at", { ascending: false }).limit(20);
        return { analyses: data || [] };
      }

      case "get_dna_submissions": {
        let query = supabase.from("test_submissions").select("id, test_type, status, respondent_name, respondent_email, ai_analysis, completed_at, created_at");
        if (args.test_type) query = query.eq("test_type", args.test_type);
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (member) query = query.eq("member_id", member.id);
        }
        const { data } = await query.eq("status", "completed").order("completed_at", { ascending: false }).limit(20);
        return { submissions: data || [] };
      }

      case "get_ai_reports": {
        const { data } = await supabase.from("ai_reports").select("id, report_type, content, generated_at, month_id").order("generated_at", { ascending: false }).limit(10);
        return { reports: data || [] };
      }

      case "create_knowledge": {
        const { data, error } = await supabase.from("company_knowledge").insert({
          title: args.title,
          content: args.content,
          category: args.category || "general",
        }).select().single();
        if (error) return { error: error.message };
        return { success: true, knowledge: { id: data.id, title: data.title } };
      }

      case "update_knowledge": {
        const item = await findByTitle(supabase, "company_knowledge", args.title_search);
        if (!item) return { error: `Item "${args.title_search}" não encontrado na base de conhecimento` };
        const updates: any = {};
        if (args.new_title) updates.title = args.new_title;
        if (args.new_content) updates.content = args.new_content;
        if (args.new_category) updates.category = args.new_category;
        if (args.active !== undefined) updates.active = args.active;
        if (Object.keys(updates).length === 0) return { error: "Nenhum campo para atualizar" };
        const { error } = await supabase.from("company_knowledge").update(updates).eq("id", item.id);
        if (error) return { error: error.message };
        return { success: true, message: `Item "${item.title}" atualizado` };
      }

      case "delete_knowledge": {
        const item = await findByTitle(supabase, "company_knowledge", args.title_search);
        if (!item) return { error: `Item "${args.title_search}" não encontrado` };
        const { error } = await supabase.from("company_knowledge").delete().eq("id", item.id);
        if (error) return { error: error.message };
        return { success: true, message: `Item "${item.title}" deletado da base de conhecimento` };
      }

      case "get_calendar_events": {
        const { data } = await supabase.from("event_reminders").select("id, event_title, event_description, event_start_at, reminder_type, lead_name, lead_phone, sent").order("event_start_at", { ascending: true }).limit(30);
        return { events: data || [] };
      }

      case "get_whatsapp_contacts": {
        const { data: contacts } = await supabase.from("whatsapp_contacts").select("id, phone, team_member_id, active");
        const { data: members } = await supabase.from("team_members").select("id, name").eq("active", true);
        const enriched = (contacts || []).map((c: any) => ({
          phone: c.phone,
          active: c.active,
          member: members?.find((m: any) => m.id === c.team_member_id)?.name || "Sem vínculo",
        }));
        return { contacts: enriched };
      }

      case "toggle_course_publish": {
        const course = await findByTitle(supabase, "training_courses", args.course_title);
        if (!course) return { error: `Curso "${args.course_title}" não encontrado` };
        const updates: any = { published: args.published };
        if (args.published) updates.published_at = new Date().toISOString();
        const { error } = await supabase.from("training_courses").update(updates).eq("id", course.id);
        if (error) return { error: error.message };
        return { success: true, message: `Curso "${course.title}" ${args.published ? "publicado" : "despublicado"}` };
      }

      case "deactivate_team_member": {
        const member = await findMember(supabase, args.member_name);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const { error } = await supabase.from("team_members").update({ active: false }).eq("id", member.id);
        if (error) return { error: error.message };
        return { success: true, message: `${member.name} desativado da equipe` };
      }

      case "reactivate_team_member": {
        const member = await findMember(supabase, args.member_name, true);
        if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
        const { error } = await supabase.from("team_members").update({ active: true }).eq("id", member.id);
        if (error) return { error: error.message };
        return { success: true, message: `${member.name} reativado na equipe` };
      }

      case "set_monthly_goals": {
        const monthId = await getOrCreateMonth(supabase, args.month, args.year);
        if (!monthId) return { error: `Não foi possível criar/encontrar mês ${args.month}/${args.year}` };
        
        let memberId = null;
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          memberId = member.id;
        }

        const { data: existing } = await supabase.from("monthly_goals")
          .select("id")
          .eq("month_id", monthId)
          .is("member_id", memberId)
          .single();

        if (existing) {
          const { error } = await supabase.from("monthly_goals").update(args.goals).eq("id", existing.id);
          if (error) return { error: error.message };
          return { success: true, message: `Metas de ${args.member_name || "global"} atualizadas para ${args.month}/${args.year}` };
        } else {
          const { error } = await supabase.from("monthly_goals").insert({ month_id: monthId, member_id: memberId, ...args.goals });
          if (error) return { error: error.message };
          return { success: true, message: `Metas de ${args.member_name || "global"} criadas para ${args.month}/${args.year}` };
        }
      }

      case "get_admin_invites": {
        const { data } = await supabase.from("admin_invites").select("id, token, created_at, expires_at, used_at, used_by").order("created_at", { ascending: false }).limit(10);
        return { invites: (data || []).map((i: any) => ({ ...i, status: i.used_at ? "usado" : new Date(i.expires_at) < new Date() ? "expirado" : "pendente" })) };
      }

      case "get_ai_tool_usage": {
        const since = daysAgo(args.days || 30);
        let query = supabase.from("ai_tool_usage").select("member_id, tool_type, created_at").gte("created_at", new Date(since).toISOString());
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          query = query.eq("member_id", member.id);
        }
        const { data } = await query;
        const { data: members } = await supabase.from("team_members").select("id, name").eq("active", true);
        const summary = (members || []).map((m: any) => {
          const usage = (data || []).filter((u: any) => u.member_id === m.id);
          const byTool: any = {};
          usage.forEach((u: any) => { byTool[u.tool_type] = (byTool[u.tool_type] || 0) + 1; });
          return { name: m.name, total: usage.length, by_tool: byTool };
        }).filter((m: any) => m.total > 0);
        return { period: `últimos ${args.days || 30} dias`, usage: summary };
      }

      case "get_test_links": {
        const { data } = await supabase.from("test_links").select("id, token, label, test_type, is_active, member_id, created_at").order("created_at", { ascending: false });
        const { data: members } = await supabase.from("team_members").select("id, name");
        return { links: (data || []).map((l: any) => ({ ...l, member_name: members?.find((m: any) => m.id === l.member_id)?.name || null })) };
      }

      case "get_training_notifications": {
        const { data } = await supabase.from("training_notifications").select("id, title, message, target_role, course_id, created_at").order("created_at", { ascending: false }).limit(20);
        return { notifications: data || [] };
      }

      case "get_weekly_goals": {
        let query = supabase.from("weekly_goals").select("*, months(label)").order("created_at", { ascending: false }).limit(20);
        if (args.member_name) {
          const member = await findMember(supabase, args.member_name);
          if (!member) return { error: `Membro "${args.member_name}" não encontrado` };
          query = query.eq("member_id", member.id);
        }
        const { data } = await query;
        return { weekly_goals: data || [] };
      }

      default:
        return { error: `Ferramenta "${name}" não reconhecida` };
    }
  } catch (e) {
    console.error(`Tool ${name} error:`, e);
    return { error: `Erro ao executar ${name}: ${e.message || e}` };
  }
}

// ── WhatsApp Z-API helper ──
async function sendZapiMessage(phone: string, message: string, memberName?: string) {
  const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const zapiToken = Deno.env.get("ZAPI_TOKEN");
  const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!zapiInstanceId || !zapiToken) return { error: "WhatsApp (Z-API) não configurado no sistema" };
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (zapiClientToken) zapiHeaders["Client-Token"] = zapiClientToken;
  const waResp = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
    method: "POST",
    headers: zapiHeaders,
    body: JSON.stringify({ phone: formattedPhone, message }),
  });
  const waResult = await waResp.json();
  if (!waResp.ok || waResult.error) {
    return { error: `Falha ao enviar WhatsApp${memberName ? ` para ${memberName}` : ""}: ${waResult.error || waResult.message || `HTTP ${waResp.status}`}` };
  }
  return { success: true, message: `Mensagem enviada${memberName ? ` para ${memberName}` : ""} (${formattedPhone})` };
}

// ── System prompt ──
const SYSTEM_PROMPT = `Você é o JARVIS, assistente COMPLETO com acesso TOTAL ao sistema de gestão de vendas. Respostas por TEXTO — seja ULTRA CONCISO.

REGRAS DE RESPOSTA:
- Máximo 2-3 frases curtas por padrão
- Só expanda se o admin pedir "detalhe", "mais info", "explica melhor"
- Sem títulos, sem listas longas, sem markdown pesado
- Use números diretos: "João fez 15 conexões, 3 reuniões"
- Emojis: máximo 1 por resposta
- NUNCA repita o que o admin disse

MESES EM PORTUGUÊS → NÚMERO:
janeiro=1, fevereiro=2, março=3, abril=4, maio=5, junho=6, julho=7, agosto=8, setembro=9, outubro=10, novembro=11, dezembro=12
SEMPRE use o parâmetro "month" quando o admin mencionar um mês específico. Ex: "métricas de janeiro" → month=1
Se o ano não for mencionado, use o ano atual (${new Date().getFullYear()}).

ACESSO TOTAL — VOCÊ PODE TUDO:
📊 DADOS: métricas diárias, metas mensais/semanais, ranking, leads, equipe
📝 CRIAR: popups motivacionais, itens de conhecimento, playbooks
✏️ EDITAR: atualizar métricas, metas mensais, ativar/desativar popups e automações, publicar/despublicar cursos
🗑️ DELETAR: popups, itens de conhecimento
👥 EQUIPE: listar, desativar/reativar membros, inspecionar tela de qualquer membro
📱 WHATSAPP: enviar mensagens para membros ou qualquer número, ver contatos, ver/ativar/desativar automações
📚 TREINAMENTO: cursos (publicar/despublicar), módulos, aulas, playbooks (criar), notificações
🧬 DNA: submissões de testes, análises IA, links de testes
📞 CLOSER: análises de ligações e comportamento
📋 PROCESSOS: fluxos e processos salvos
📅 AGENDA: eventos e lembretes do calendário
🧠 CONHECIMENTO: base de conhecimento (CRUD completo)
📈 RELATÓRIOS: relatórios IA gerados
🔧 CONFIGURAÇÕES: navegar para qualquer página, filtrar dashboard
🔍 INSPEÇÃO: ver tela como qualquer membro vê
📊 ANALYTICS: uso de ferramentas IA por membro, convites admin

NAVEGAÇÃO: quando pedirem para ABRIR/IR/MOSTRAR qualquer página, use navigate_to_page. O marker [ACTION:navigate:page] será incluído automaticamente.
INSPEÇÃO: quando pedirem para "ver como o João vê" ou "inspecionar membro", use inspect_member. O marker [ACTION:inspect:id] será incluído.
FILTRO DASHBOARD: quando pedirem para "filtrar dashboard pelo João" ou "mostrar métricas de março", use filter_dashboard.

PÁGINAS: dashboard, team, goals, reports, training, calendars, whatsapp, knowledge, dna-mapping, settings, popups, processos, closer-entry, playbooks

AÇÕES DESTRUTIVAS: confirme antes, exceto se explícito.
Responda SEMPRE em pt-BR.

MÉTRICAS: SDR (Conexões, Aceitas, Abordagens, InMail, Follow-up, Número, Lig.Agendada) | Closer (Lig.Realizada, Reunião Agendada/Realizada)

IMPORTANTE: Quando um tool retornar um campo "marker", SEMPRE inclua esse marker exatamente como está na sua resposta. Ex: se retornar marker: "[ACTION:navigate:team]", inclua [ACTION:navigate:team] na resposta.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { messages } = await req.json();

    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    let currentMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.filter((m: any) => m.role !== "system"),
    ];

    // ── Tool calling loop ──
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch(GATEWAY, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({ model: MODEL, messages: currentMessages, tools: TOOLS, temperature: 0.3 }),
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

      if (!toolCalls?.length) {
        const content = assistantMsg.content || "";
        const sseChunks = [];
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

    const finalResponse = await fetch(GATEWAY, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ model: MODEL, messages: currentMessages, stream: true, temperature: 0.3 }),
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
