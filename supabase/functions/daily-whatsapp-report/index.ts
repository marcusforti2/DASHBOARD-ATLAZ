import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ULTRAMSG_INSTANCE_ID = Deno.env.get("ULTRAMSG_INSTANCE_ID");
    const ULTRAMSG_TOKEN = Deno.env.get("ULTRAMSG_TOKEN");

    if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_TOKEN) {
      throw new Error("Credenciais Ultramsg não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional body for test/manual trigger
    let targetMemberId: string | null = null;
    let skipAi = false;
    try {
      const body = await req.json();
      targetMemberId = body?.member_id || null;
      skipAi = body?.skip_ai || false;
    } catch { /* no body = cron trigger */ }

    // Get current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const today = now.toISOString().split("T")[0];

    const { data: monthData } = await supabase
      .from("months")
      .select("*")
      .eq("year", currentYear)
      .eq("month", currentMonth)
      .maybeSingle();

    if (!monthData) {
      return new Response(JSON.stringify({ error: "Mês atual não encontrado no sistema" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get team members
    const { data: members } = await supabase
      .from("team_members")
      .select("*")
      .eq("active", true)
      .order("name");

    // Get monthly goals (team)
    const { data: teamGoal } = await supabase
      .from("monthly_goals")
      .select("*")
      .eq("month_id", monthData.id)
      .is("member_id", null)
      .maybeSingle();

    // Get all daily metrics for this month
    const { data: allMetrics } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("month_id", monthData.id);

    // Get today's metrics
    const todayMetrics = (allMetrics || []).filter((m: any) => m.date === today);

    // Get whatsapp contacts
    let contactsQuery = supabase.from("whatsapp_contacts").select("*").eq("active", true);
    if (targetMemberId) {
      contactsQuery = contactsQuery.eq("team_member_id", targetMemberId);
    }
    const { data: contacts } = await contactsQuery;

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum contato WhatsApp cadastrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const contact of contacts) {
      const member = (members || []).find((m: any) => m.id === contact.team_member_id);
      if (!member) continue;

      const role = member.member_role || "sdr";
      const metricKeys = role === "closer" ? CLOSER_KEYS : SDR_KEYS;

      // Member's metrics today
      const memberToday = todayMetrics.filter((m: any) => m.member_id === member.id);
      const todaySums: Record<string, number> = {};
      metricKeys.forEach(k => {
        todaySums[k] = memberToday.reduce((sum: number, m: any) => sum + (m[k] || 0), 0);
      });

      // Member's total month
      const memberMonth = (allMetrics || []).filter((m: any) => m.member_id === member.id);
      const monthSums: Record<string, number> = {};
      metricKeys.forEach(k => {
        monthSums[k] = memberMonth.reduce((sum: number, m: any) => sum + (m[k] || 0), 0);
      });

      // Calculate individual goal (team goal / members of same role)
      const sameRoleCount = (members || []).filter((m: any) => (m.member_role || "sdr") === role).length || 1;
      const individualGoal: Record<string, number> = {};
      metricKeys.forEach(k => {
        individualGoal[k] = teamGoal ? Math.max(1, Math.round((teamGoal[k] || 0) / sameRoleCount)) : 0;
      });

      // Build metrics text
      let metricsText = `📊 *Relatório Diário - ${member.name}*\n`;
      metricsText += `📅 ${today}\n\n`;
      
      metricsText += `*Hoje:*\n`;
      metricKeys.forEach(k => {
        metricsText += `  ${METRIC_LABELS[k]}: ${todaySums[k]}\n`;
      });

      metricsText += `\n*Acumulado do Mês:*\n`;
      metricKeys.forEach(k => {
        const goal = individualGoal[k];
        const done = monthSums[k];
        const pct = goal > 0 ? Math.round((done / goal) * 100) : 0;
        const emoji = pct >= 100 ? "✅" : pct >= 70 ? "🟡" : "🔴";
        metricsText += `  ${emoji} ${METRIC_LABELS[k]}: ${done}/${goal} (${pct}%)\n`;
      });

      // Remaining to goal
      metricsText += `\n*Falta para a Meta:*\n`;
      metricKeys.forEach(k => {
        const remaining = Math.max(0, individualGoal[k] - monthSums[k]);
        if (remaining > 0) {
          metricsText += `  ⚡ ${METRIC_LABELS[k]}: faltam ${remaining}\n`;
        }
      });

      // Generate AI tips if available
      let aiTips = "";
      if (LOVABLE_API_KEY && !skipAi) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: "Você é um coach de vendas. Dê 3 dicas curtas e práticas (máximo 1 linha cada) para o SDR melhorar seus resultados amanhã. Use emojis. Seja direto e motivacional. Responda APENAS as 3 dicas, sem introdução.",
                },
                {
                  role: "user",
                  content: `SDR: ${member.name} (${role})\nMétricas hoje: ${JSON.stringify(todaySums)}\nAcumulado mês: ${JSON.stringify(monthSums)}\nMeta individual: ${JSON.stringify(individualGoal)}`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiTips = aiData.choices?.[0]?.message?.content || "";
          }
        } catch (e) {
          console.error("AI tips error:", e);
        }
      }

      if (aiTips) {
        metricsText += `\n💡 *Dicas para Amanhã:*\n${aiTips}`;
      }

      metricsText += `\n\n_Enviado automaticamente pelo System Canvas Pro_`;

      // Send via Ultramsg
      const phone = contact.phone.startsWith("55") ? contact.phone : `55${contact.phone}`;
      const sendResponse = await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: ULTRAMSG_TOKEN,
          to: phone,
          body: metricsText,
        }),
      });

      const sendData = await sendResponse.json();
      results.push({
        member: member.name,
        phone,
        success: !sendData.error,
        data: sendData,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
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
