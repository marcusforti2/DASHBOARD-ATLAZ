import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const METRIC_LABELS: Record<string, string> = {
  conexoes: "Conexões",
  conexoes_aceitas: "Conexões Aceitas",
  abordagens: "Abordagens",
  inmail: "InMail",
  follow_up: "Follow Up",
  numero: "Número",
  lig_agendada: "Lig. Agendada",
  lig_realizada: "Lig. Realizada",
  reuniao_agendada: "Reunião Agendada",
  reuniao_realizada: "Reunião Realizada",
};

const SDR_KEYS = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada"];
const CLOSER_KEYS = ["lig_realizada", "reuniao_agendada", "reuniao_realizada"];
const ALL_KEYS = [...SDR_KEYS, ...CLOSER_KEYS];

// Helper to build structured data for AI
function buildMetricsContext(
  contactName: string,
  contactRole: string,
  todaySums: Record<string, number>,
  monthSums: Record<string, number>,
  goalSums: Record<string, number>,
  keys: string[],
  ranking: string,
  today: string,
) {
  const metricsToday = keys.map(k => `${METRIC_LABELS[k]}: ${todaySums[k] || 0}`).join(", ");
  const metricsMonth = keys.map(k => {
    const done = monthSums[k] || 0;
    const goal = goalSums[k] || 0;
    const pct = goal > 0 ? Math.round((done / goal) * 100) : 0;
    return `${METRIC_LABELS[k]}: ${done}/${goal} (${pct}%)`;
  }).join(", ");

  const faltaMeta = keys
    .filter(k => (goalSums[k] || 0) > (monthSums[k] || 0))
    .map(k => `${METRIC_LABELS[k]}: faltam ${(goalSums[k] || 0) - (monthSums[k] || 0)}`)
    .join(", ");

  // Format date as dd/mm/aa (Brazilian)
  const [yyyy, mm, dd] = today.split("-");
  const dataBr = `${dd}/${mm}/${yyyy.slice(2)}`;

  return {
    nome: contactName,
    role: contactRole,
    data: dataBr,
    metricsToday,
    metricsMonth,
    faltaMeta: faltaMeta || "Todas as metas batidas! 🎉",
    ranking,
  };
}

// AI agent that composes the full personalized message
async function composePersonalizedMessage(
  apiKey: string,
  template: string,
  context: ReturnType<typeof buildMetricsContext>,
  includeAiTips: boolean,
): Promise<string> {
  const systemPrompt = `Você é o assistente de comunicação do System Canvas Pro, uma plataforma de gestão de vendas.

Sua tarefa: compor uma mensagem de WhatsApp COMPLETA e PERSONALIZADA para um membro da equipe usando os dados reais fornecidos.

REGRAS OBRIGATÓRIAS:
1. Use o template fornecido como GUIA DE ESTILO - siga a estrutura, tom e formato dele
2. PREENCHA todos os dados com os valores REAIS fornecidos - NUNCA invente números
3. A mensagem deve ser natural, motivacional e profissional
4. Use emojis de forma moderada e estratégica
5. Se o template menciona métricas, inclua os dados reais formatados de forma clara
6. Se o template menciona progresso/meta, mostre os percentuais reais com emojis indicativos (✅ ≥100%, 🟡 ≥70%, 🔴 <70%)
7. Se o template menciona ranking, inclua o ranking real
8. Se o template menciona dicas, gere 3 dicas PRÁTICAS e ESPECÍFICAS baseadas nos dados (não genéricas)
${includeAiTips ? '9. Sempre inclua dicas personalizadas no final, baseadas nos pontos fracos dos dados' : '9. NÃO inclua dicas a menos que o template peça'}
10. NÃO adicione assinatura no final (será adicionada automaticamente)
11. A mensagem deve parecer escrita por um ser humano, não por uma máquina
12. Mantenha a mensagem concisa mas completa - ideal entre 15-30 linhas
13. RESPONDA APENAS COM A MENSAGEM PRONTA, sem explicação ou comentário adicional`;

  const userPrompt = `TEMPLATE DE REFERÊNCIA:
"""
${template}
"""

DADOS REAIS DO CONTATO:
- Nome: ${context.nome}
- Função: ${context.role === "sdr" ? "SDR (pré-vendas)" : context.role === "closer" ? "Closer (fechamento)" : "Administrador"}
- Data: ${context.data}

MÉTRICAS DE HOJE:
${context.metricsToday}

ACUMULADO DO MÊS (realizado/meta e %):
${context.metricsMonth}

O QUE FALTA PARA BATER A META:
${context.faltaMeta}

RANKING DA EQUIPE:
${context.ranking}

Agora componha a mensagem personalizada seguindo o template e usando TODOS os dados reais acima.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI compose error:", response.status, errText);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Fallback: mechanical template fill (used when AI is unavailable)
function mechanicalFill(
  template: string,
  context: ReturnType<typeof buildMetricsContext>,
): string {
  let text = template;
  text = text.replace(/\{\{nome\}\}/g, context.nome);
  text = text.replace(/\{\{data\}\}/g, context.data);
  text = text.replace(/\{\{role\}\}/g, context.role);
  text = text.replace(/\{\{metricas_hoje\}\}/g, context.metricsToday);
  text = text.replace(/\{\{metricas_mes\}\}/g, context.metricsMonth);
  text = text.replace(/\{\{progresso_meta\}\}/g, context.metricsMonth);
  text = text.replace(/\{\{falta_meta\}\}/g, context.faltaMeta);
  text = text.replace(/\{\{ranking\}\}/g, context.ranking);
  text = text.replace(/\{\{dicas_ia\}\}/g, "");
  text = text.replace(/\{\{[a-z_]+\}\}/g, "");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      throw new Error("Credenciais Z-API não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let automationId: string | null = null;
    let targetMemberId: string | null = null;
    let skipAi = false;
    try {
      const body = await req.json();
      automationId = body?.automation_id || null;
      targetMemberId = body?.member_id || null;
      skipAi = body?.skip_ai || false;
    } catch { /* no body = cron trigger */ }

    let automation: any = null;
    if (automationId) {
      const { data } = await supabase
        .from("whatsapp_automations")
        .select("*")
        .eq("id", automationId)
        .maybeSingle();
      automation = data;
    }

    const targetAudience = automation?.target_audience || "all";
    const includeMetrics = automation?.include_metrics ?? true;
    const includeAiTips = automation?.include_ai_tips ?? true;
    const messageTemplate = automation?.message_template || "Olá {{nome}}! 📊\n\nSeu progresso hoje:\n{{metricas_hoje}}\n\nAcumulado do mês:\n{{progresso_meta}}\n\n{{dicas_ia}}";

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const today = now.toISOString().split("T")[0];

    const { data: monthData } = await supabase
      .from("months").select("*")
      .eq("year", currentYear).eq("month", currentMonth)
      .maybeSingle();

    if (!monthData) {
      return new Response(JSON.stringify({ error: "Mês atual não encontrado no sistema" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parallel data fetch
    const [
      { data: members },
      { data: teamGoal },
      { data: allMetrics },
      { data: contacts },
      { data: adminRoles },
      { data: profiles },
    ] = await Promise.all([
      supabase.from("team_members").select("*").eq("active", true).order("name"),
      supabase.from("monthly_goals").select("*").eq("month_id", monthData.id).is("member_id", null).maybeSingle(),
      supabase.from("daily_metrics").select("*").eq("month_id", monthData.id),
      supabase.from("whatsapp_contacts").select("*").eq("active", true),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum contato WhatsApp cadastrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || "Admin"]));
    const todayMetrics = (allMetrics || []).filter((m: any) => m.date === today);

    // Filter contacts by audience
    const filteredContacts = contacts.filter((contact: any) => {
      if (targetMemberId) return contact.team_member_id === targetMemberId;
      switch (targetAudience) {
        case "admins": return contact.user_id && adminUserIds.has(contact.user_id);
        case "sdrs": {
          if (!contact.team_member_id) return false;
          const m = (members || []).find((mem: any) => mem.id === contact.team_member_id);
          return m && (m.member_role || "sdr").includes("sdr");
        }
        case "closers": {
          if (!contact.team_member_id) return false;
          const m = (members || []).find((mem: any) => mem.id === contact.team_member_id);
          return m && (m.member_role || "").includes("closer");
        }
        case "team": return !!contact.team_member_id;
        default: return true;
      }
    });

    if (filteredContacts.length === 0) {
      return new Response(JSON.stringify({ error: `Nenhum contato encontrado para: ${targetAudience}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build ranking
    function buildRanking(): string {
      if (!members || members.length === 0) return "Sem dados de ranking";
      const ranked = members.map((m: any) => {
        const role = m.member_role || "sdr";
        const keys = role.includes("closer") ? (role.includes("sdr") ? ALL_KEYS : CLOSER_KEYS) : SDR_KEYS;
        const mMetrics = (allMetrics || []).filter((dm: any) => dm.member_id === m.id);
        const total = keys.reduce((sum, k) => sum + mMetrics.reduce((s: number, dm: any) => s + (dm[k] || 0), 0), 0);
        return { name: m.name, role, total };
      }).sort((a, b) => b.total - a.total);
      return ranked.map((r, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return `${medal} ${r.name}: ${r.total} atividades`;
      }).join("\n");
    }

    const ranking = buildRanking();

    // Team totals for admin contacts
    const teamTodaySums: Record<string, number> = {};
    const teamMonthSums: Record<string, number> = {};
    const teamGoalSums: Record<string, number> = {};
    ALL_KEYS.forEach(k => {
      teamTodaySums[k] = todayMetrics.reduce((sum: number, m: any) => sum + (m[k] || 0), 0);
      teamMonthSums[k] = (allMetrics || []).reduce((sum: number, m: any) => sum + (m[k] || 0), 0);
      teamGoalSums[k] = teamGoal?.[k] || 0;
    });

    const useAi = !!LOVABLE_API_KEY && !skipAi;
    const results: any[] = [];

    for (const contact of filteredContacts) {
      try {
        let contactName = "";
        let contactRole = "";
        let context: ReturnType<typeof buildMetricsContext>;

        if (contact.team_member_id) {
          const member = (members || []).find((m: any) => m.id === contact.team_member_id);
          if (!member) continue;

          contactName = member.name;
          contactRole = member.member_role || "sdr";
          const keys = contactRole.includes("closer") ? (contactRole.includes("sdr") ? ALL_KEYS : CLOSER_KEYS) : SDR_KEYS;

          const memberToday = todayMetrics.filter((m: any) => m.member_id === member.id);
          const todaySums: Record<string, number> = {};
          keys.forEach(k => { todaySums[k] = memberToday.reduce((sum: number, m: any) => sum + (m[k] || 0), 0); });

          const memberMonth = (allMetrics || []).filter((m: any) => m.member_id === member.id);
          const monthSums: Record<string, number> = {};
          keys.forEach(k => { monthSums[k] = memberMonth.reduce((sum: number, m: any) => sum + (m[k] || 0), 0); });

          const sameRoleCount = (members || []).filter((m: any) => (m.member_role || "sdr").includes("sdr") === contactRole.includes("sdr") && (m.member_role || "").includes("closer") === contactRole.includes("closer")).length || 1;
          const individualGoal: Record<string, number> = {};
          keys.forEach(k => { individualGoal[k] = teamGoal ? Math.max(1, Math.round((teamGoal[k] || 0) / sameRoleCount)) : 0; });

          context = buildMetricsContext(contactName, contactRole, todaySums, monthSums, individualGoal, keys, ranking, today);
        } else if (contact.user_id) {
          contactName = profileMap.get(contact.user_id) || "Admin";
          contactRole = "admin";
          context = buildMetricsContext(contactName, contactRole, teamTodaySums, teamMonthSums, teamGoalSums, ALL_KEYS, ranking, today);
        } else {
          continue;
        }

        let finalMessage: string;

        if (useAi) {
          try {
            finalMessage = await composePersonalizedMessage(LOVABLE_API_KEY!, messageTemplate, context, includeAiTips);
          } catch (aiErr) {
            console.error("AI fallback to mechanical fill:", aiErr);
            finalMessage = mechanicalFill(messageTemplate, context);
          }
        } else {
          finalMessage = mechanicalFill(messageTemplate, context);
        }

        finalMessage += `\n\n_Enviado pelo System Canvas Pro_`;

        // Send via Z-API
        const cleanPhone = contact.phone.replace(/\D/g, "");
        const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
        const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (ZAPI_CLIENT_TOKEN) zapiHeaders["Client-Token"] = ZAPI_CLIENT_TOKEN;
        const sendResponse = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`, {
          method: "POST",
          headers: zapiHeaders,
          body: JSON.stringify({ phone, message: finalMessage }),
        });

        const sendData = await sendResponse.json();
        results.push({
          member: contactName,
          role: contactRole,
          phone,
          success: !sendData.error,
          ai_composed: useAi,
          data: sendData,
        });

        // Small delay between contacts to avoid rate limits
        if (filteredContacts.length > 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (contactError) {
        console.error("Error processing contact:", contactError);
        results.push({
          member: contact.team_member_id || contact.user_id,
          phone: contact.phone,
          success: false,
          error: contactError instanceof Error ? contactError.message : "Erro",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      audience: targetAudience,
      contacts_found: filteredContacts.length,
      ai_enabled: useAi,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-whatsapp-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
