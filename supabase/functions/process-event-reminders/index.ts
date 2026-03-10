import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      throw new Error("Credenciais Z-API não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get pending reminders where remind_at <= now and not sent
    const now = new Date();
    const { data: reminders, error } = await supabase
      .from("event_reminders")
      .select("*")
      .eq("sent", false)
      .lte("remind_at", now.toISOString())
      .order("remind_at");

    if (error) throw error;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check business hours (8h-21h BRT = UTC-3)
    const brtHour = (now.getUTCHours() - 3 + 24) % 24;
    const isBusinessHours = brtHour >= 8 && brtHour < 21;
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;

    if (!isBusinessHours || !isWeekday) {
      return new Response(JSON.stringify({ processed: 0, reason: "outside_business_hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const reminder of reminders) {
      try {
        let message = "";

        // Generate AI message
        if (LOVABLE_API_KEY) {
          const systemPrompt = reminder.reminder_type === "lead"
            ? `Você é um assistente de vendas brasileiro. Gere uma mensagem curta de WhatsApp (máx 3 linhas) para um LEAD lembrando sobre uma reunião agendada. 
               Seja educado, profissional e amigável. Use emojis moderadamente.
               Se for perto da hora (5min ou na hora), seja urgente mas simpático.
               Se for 24h/12h antes, seja mais casual e confirmatório.
               A mensagem deve ser anti-noshow: faça o lead se sentir importante e valorizado.
               Analise a descrição do evento para personalizar a mensagem.
               NÃO inclua saudações genéricas. Vá direto ao ponto.`
            : `Você é um assistente de vendas brasileiro. Gere uma mensagem curta de WhatsApp (máx 3 linhas) para um MEMBRO DO TIME (closer/SDR) avisando sobre um agendamento.
               Seja motivacional e energético. Use emojis.
               Se for perto da hora, aumente a urgência e animação.
               Destaque que é uma oportunidade. Motive o closer/SDR.
               Analise a descrição do evento para personalizar a mensagem.
               NÃO inclua saudações genéricas. Vá direto ao ponto.`;

          const userPrompt = `Evento: "${reminder.event_title}"
Descrição: "${reminder.event_description || 'Sem descrição'}"
Lead: ${reminder.lead_name || 'Não informado'}
Horário: ${new Date(reminder.event_start_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
Tipo de lembrete: ${reminder.reminder_label} antes
Tipo de destinatário: ${reminder.reminder_type === "lead" ? "Lead/Cliente" : "Membro do time (closer/SDR)"}`;

          try {
            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
              }),
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              message = aiData.choices?.[0]?.message?.content || "";
            }
          } catch (e) {
            console.error("AI generation failed:", e);
          }
        }

        // Fallback message
        if (!message) {
          const timeStr = new Date(reminder.event_start_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
          if (reminder.reminder_type === "lead") {
            message = `⏰ Olá${reminder.lead_name ? ` ${reminder.lead_name}` : ""}! Lembrando da sua reunião "${reminder.event_title}" agendada para ${timeStr}. Nos vemos lá! 🤝`;
          } else {
            message = `🔥 Atenção! Você tem a reunião "${reminder.event_title}" agendada para ${timeStr}${reminder.lead_name ? ` com ${reminder.lead_name}` : ""}. Bora fechar! 💪`;
          }
        }

        // Send WhatsApp via Z-API
        if (reminder.reminder_type === "lead" && reminder.lead_phone) {
          await sendWhatsApp(ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN, reminder.lead_phone, message);
        } else if (reminder.reminder_type === "team" && reminder.team_member_ids?.length > 0) {
          const { data: contacts } = await supabase
            .from("whatsapp_contacts")
            .select("phone, team_member_id")
            .in("team_member_id", reminder.team_member_ids)
            .eq("active", true);

          if (contacts) {
            for (const contact of contacts) {
              await sendWhatsApp(ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN, contact.phone, message);
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }

        // Mark as sent
        await supabase.from("event_reminders").update({ sent: true, sent_at: now.toISOString() }).eq("id", reminder.id);
        processed++;

        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`Failed to process reminder ${reminder.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ processed, total: reminders.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-event-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsApp(instanceId: string, token: string, clientToken: string | undefined, phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: formattedPhone, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Z-API error: ${res.status} ${text}`);
  }
  return res.json();
}
