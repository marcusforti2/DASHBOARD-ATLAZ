import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maps Dripify action query param to our metric column
const ACTION_MAP: Record<string, string> = {
  conexoes: "conexoes",
  conexoes_aceitas: "conexoes_aceitas",
  abordagens: "abordagens",
  inmail: "inmail",
  follow_up: "follow_up",
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("member_id");
    const action = url.searchParams.get("action");

    if (!memberId || !action) {
      return new Response(
        JSON.stringify({ error: "Parâmetros member_id e action são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metricCol = ACTION_MAP[action];
    if (!metricCol) {
      return new Response(
        JSON.stringify({ error: `Ação inválida: ${action}. Válidas: ${Object.keys(ACTION_MAP).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify member exists
    const { data: member, error: memberErr } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("id", memberId)
      .single();

    if (memberErr || !member) {
      return new Response(
        JSON.stringify({ error: "Membro não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current date in BRT (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const dateStr = brt.toISOString().split("T")[0];
    const dayOfWeek = DAY_NAMES[brt.getUTCDay()];
    const currentMonth = brt.getUTCMonth() + 1;
    const currentYear = brt.getUTCFullYear();

    // Find or create the current month
    let { data: monthData } = await supabase
      .from("months")
      .select("id")
      .eq("year", currentYear)
      .eq("month", currentMonth)
      .single();

    if (!monthData) {
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const { data: newMonth, error: createErr } = await supabase
        .from("months")
        .insert({ year: currentYear, month: currentMonth, label: `${monthNames[currentMonth - 1]} ${currentYear}` })
        .select("id")
        .single();
      if (createErr) throw new Error(`Erro ao criar mês: ${createErr.message}`);
      monthData = newMonth;
    }

    // Check if daily_metrics row exists for this member + date
    const { data: existing } = await supabase
      .from("daily_metrics")
      .select("id, " + metricCol)
      .eq("member_id", memberId)
      .eq("date", dateStr)
      .single();

    if (existing) {
      // Increment the metric
      const currentVal = (existing as any)[metricCol] || 0;
      const { error: updateErr } = await supabase
        .from("daily_metrics")
        .update({ [metricCol]: currentVal + 1 })
        .eq("id", existing.id);
      if (updateErr) throw new Error(`Erro ao atualizar métrica: ${updateErr.message}`);
    } else {
      // Create new row with this metric = 1
      const { error: insertErr } = await supabase
        .from("daily_metrics")
        .insert({
          member_id: memberId,
          month_id: monthData!.id,
          date: dateStr,
          day_of_week: dayOfWeek,
          [metricCol]: 1,
        });
      if (insertErr) throw new Error(`Erro ao inserir métrica: ${insertErr.message}`);
    }

    console.log(`✅ Webhook Dripify: ${member.name} +1 ${action} em ${dateStr}`);

    return new Response(
      JSON.stringify({ success: true, member: member.name, action, date: dateStr }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no webhook Dripify:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
