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
const ALL_KEYS = [...SDR_KEYS, ...CLOSER_KEYS];

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

    // Parse body
    let automationId: string | null = null;
    let targetMemberId: string | null = null;
    let skipAi = false;
    try {
      const body = await req.json();
      automationId = body?.automation_id || null;
      targetMemberId = body?.member_id || null;
      skipAi = body?.skip_ai || false;
    } catch { /* no body = cron trigger */ }

    // Load automation config if provided
    let automation: any = null;
    if (automationId) {
      const { data } = await supabase
        .from("whatsapp_automations")
        .select("*")
        .eq("id", automationId)
        .maybeSingle();
      automation = data;
    }

    // Defaults from automation or fallback
    const targetAudience = automation?.target_audience || "all";
    const includeMetrics = automation?.include_metrics ?? true;
    const includeAiTips = automation?.include_ai_tips ?? true;
    const messageTemplate = automation?.message_template || null;

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

    const todayMetrics = (allMetrics || []).filter((m: any) => m.date === today);

    // Get whatsapp contacts
    const { data: contacts } = await supabase
      .from("whatsapp_contacts")
      .select("*")
      .eq("active", true);

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum contato WhatsApp cadastrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin profiles for admin contacts
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name");
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || "Admin"]));

    // Filter contacts by target audience
    const filteredContacts = contacts.filter((contact: any) => {
      if (targetMemberId) return contact.team_member_id === targetMemberId;

      switch (targetAudience) {
        case "admins":
          return contact.user_id && adminUserIds.has(contact.user_id);
        case "sdrs": {
          if (!contact.team_member_id) return false;
          const m = (members || []).find((mem: any) => mem.id === contact.team_member_id);
          return m && (m.member_role || "sdr") === "sdr";
        }
        case "closers": {
          if (!contact.team_member_id) return false;
          const m = (members || []).find((mem: any) => mem.id === contact.team_member_id);
          return m && m.member_role === "closer";
        }
        case "team":
          return !!contact.team_member_id;
        case "all":
        default:
          return true;
      }
    });

    if (filteredContacts.length === 0) {
      return new Response(JSON.stringify({ error: `Nenhum contato encontrado para o público: ${targetAudience}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute team totals for template placeholders
    const teamTodaySums: Record<string, number> = {};
    const teamMonthSums: Record<string, number> = {};
    ALL_KEYS.forEach(k => {
      teamTodaySums[k] = todayMetrics.reduce((sum: number, m: any) => sum + (m[k] || 0), 0);
      teamMonthSums[k] = (allMetrics || []).reduce((sum: number, m: any) => sum + (m[k] || 0), 0);
    });

    // Build ranking for template
    function buildRanking(): string {
      if (!members || members.length === 0) return "Sem dados de ranking";
      const ranked = members.map((m: any) => {
        const role = m.member_role || "sdr";
        const keys = role === "closer" ? CLOSER_KEYS : SDR_KEYS;
        const memberMetrics = (allMetrics || []).filter((dm: any) => dm.member_id === m.id);
        const total = keys.reduce((sum, k) => sum + memberMetrics.reduce((s: number, dm: any) => s + (dm[k] || 0), 0), 0);
        return { name: m.name, role, total };
      }).sort((a, b) => b.total - a.total);

      return ranked.map((r, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return `${medal} ${r.name}: ${r.total} atividades`;
      }).join("\n");
    }

    // Helper: replace template placeholders
    function fillTemplate(template: string, contactName: string, contactRole: string, memberMetrics?: { today: Record<string, number>; month: Record<string, number>; goal: Record<string, number> }): string {
      let text = template;
      text = text.replace(/\{\{nome\}\}/g, contactName);
      text = text.replace(/\{\{data\}\}/g, today);
      text = text.replace(/\{\{role\}\}/g, contactRole);

      if (memberMetrics && includeMetrics) {
        const keys = contactRole === "closer" ? CLOSER_KEYS : (contactRole === "admin" ? ALL_KEYS : SDR_KEYS);

        // {{metricas_hoje}}
        const metricasHoje = keys.map(k => `  ${METRIC_LABELS[k]}: ${memberMetrics.today[k] || 0}`).join("\n");
        text = text.replace(/\{\{metricas_hoje\}\}/g, metricasHoje);

        // {{metricas_mes}}
        const metricasMes = keys.map(k => `  ${METRIC_LABELS[k]}: ${memberMetrics.month[k] || 0}`).join("\n");
        text = text.replace(/\{\{metricas_mes\}\}/g, metricasMes);

        // {{progresso_meta}}
        const progressoMeta = keys.map(k => {
          const done = memberMetrics.month[k] || 0;
          const goal = memberMetrics.goal[k] || 0;
          const pct = goal > 0 ? Math.round((done / goal) * 100) : 0;
          const emoji = pct >= 100 ? "✅" : pct >= 70 ? "🟡" : "🔴";
          return `  ${emoji} ${METRIC_LABELS[k]}: ${done}/${goal} (${pct}%)`;
        }).join("\n");
        text = text.replace(/\{\{progresso_meta\}\}/g, progressoMeta);
      } else {
        // For admins without personal metrics, use team totals
        const metricasHoje = ALL_KEYS.map(k => `  ${METRIC_LABELS[k]}: ${teamTodaySums[k]}`).join("\n");
        text = text.replace(/\{\{metricas_hoje\}\}/g, metricasHoje);

        const metricasMes = ALL_KEYS.map(k => `  ${METRIC_LABELS[k]}: ${teamMonthSums[k]}`).join("\n");
        text = text.replace(/\{\{metricas_mes\}\}/g, metricasMes);

        const teamGoalMetrics = ALL_KEYS.map(k => {
          const done = teamMonthSums[k];
          const goal = teamGoal?.[k] || 0;
          const pct = goal > 0 ? Math.round((done / goal) * 100) : 0;
          const emoji = pct >= 100 ? "✅" : pct >= 70 ? "🟡" : "🔴";
          return `  ${emoji} ${METRIC_LABELS[k]}: ${done}/${goal} (${pct}%)`;
        }).join("\n");
        text = text.replace(/\{\{progresso_meta\}\}/g, teamGoalMetrics);
      }

      // {{ranking}}
      text = text.replace(/\{\{ranking\}\}/g, buildRanking());

      return text;
    }

    // Fallback template when automation has no template
    const DEFAULT_TEMPLATE = "Olá {{nome}}! 📊\n\n{{progresso_meta}}";

    const results: any[] = [];

    for (const contact of filteredContacts) {
      try {
        let finalMessage = "";
        let contactName = "";
        let contactRole = "";

        if (contact.team_member_id) {
          // Team member contact
          const member = (members || []).find((m: any) => m.id === contact.team_member_id);
          if (!member) continue;

          contactName = member.name;
          contactRole = member.member_role || "sdr";
          const metricKeys = contactRole === "closer" ? CLOSER_KEYS : SDR_KEYS;

          const memberToday = todayMetrics.filter((m: any) => m.member_id === member.id);
          const todaySums: Record<string, number> = {};
          metricKeys.forEach(k => { todaySums[k] = memberToday.reduce((sum: number, m: any) => sum + (m[k] || 0), 0); });

          const memberMonth = (allMetrics || []).filter((m: any) => m.member_id === member.id);
          const monthSums: Record<string, number> = {};
          metricKeys.forEach(k => { monthSums[k] = memberMonth.reduce((sum: number, m: any) => sum + (m[k] || 0), 0); });

          const sameRoleCount = (members || []).filter((m: any) => (m.member_role || "sdr") === contactRole).length || 1;
          const individualGoal: Record<string, number> = {};
          metricKeys.forEach(k => { individualGoal[k] = teamGoal ? Math.max(1, Math.round((teamGoal[k] || 0) / sameRoleCount)) : 0; });

          finalMessage = fillTemplate(messageTemplate || DEFAULT_TEMPLATE, contactName, contactRole, {
            today: todaySums,
            month: monthSums,
            goal: individualGoal,
          });
        } else if (contact.user_id) {
          // Admin contact
          contactName = profileMap.get(contact.user_id) || "Admin";
          contactRole = "admin";

          finalMessage = fillTemplate(messageTemplate || DEFAULT_TEMPLATE, contactName, contactRole);
        } else {
          continue;
        }

        // AI tips
        if (includeAiTips && LOVABLE_API_KEY && !skipAi) {
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
                    content: "Você é um coach de vendas. Dê 3 dicas curtas e práticas (máximo 1 linha cada) baseadas nos dados. Use emojis. Seja direto e motivacional. Responda APENAS as 3 dicas, sem introdução.",
                  },
                  {
                    role: "user",
                    content: `Nome: ${contactName} (${contactRole})\nMétricas hoje equipe: ${JSON.stringify(teamTodaySums)}\nAcumulado mês equipe: ${JSON.stringify(teamMonthSums)}`,
                  },
                ],
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const tips = aiData.choices?.[0]?.message?.content || "";
              if (tips) {
                // Replace {{dicas_ia}} in message or append
                if (finalMessage.includes("{{dicas_ia}}")) {
                  finalMessage = finalMessage.replace(/\{\{dicas_ia\}\}/g, tips);
                } else {
                  finalMessage += `\n\n💡 *Dicas:*\n${tips}`;
                }
              }
            }
          } catch (e) {
            console.error("AI tips error:", e);
          }
        }

        // Remove any remaining unfilled placeholders
        finalMessage = finalMessage.replace(/\{\{[a-z_]+\}\}/g, "");

        finalMessage += `\n\n_Enviado pelo System Canvas Pro_`;

        // Send via Ultramsg
        const phone = contact.phone.startsWith("55") ? contact.phone : `55${contact.phone}`;
        const sendResponse = await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: ULTRAMSG_TOKEN,
            to: phone,
            body: finalMessage,
          }),
        });

        const sendData = await sendResponse.json();
        results.push({
          member: contactName,
          role: contactRole,
          phone,
          success: !sendData.error,
          data: sendData,
        });
      } catch (contactError) {
        console.error(`Error processing contact:`, contactError);
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
