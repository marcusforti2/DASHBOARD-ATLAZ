import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Attendee {
  name: string;
  phone: string;
  type: "closer" | "client";
}

interface EventDetails {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  organizerName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const TOKEN = Deno.env.get("ZAPI_TOKEN");
    const CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!INSTANCE_ID || !TOKEN) throw new Error("Credenciais Z-API não configuradas");

    const { attendees, event }: { attendees: Attendee[]; event: EventDetails } = await req.json();

    if (!attendees?.length || !event?.title) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { name: string; phone: string; success: boolean; error?: string }[] = [];

    for (const attendee of attendees) {
      if (!attendee.phone) continue;

      // Generate AI message
      let message: string;
      try {
        message = await generateMessage(attendee, event, LOVABLE_API_KEY);
      } catch {
        // Fallback message
        message = buildFallbackMessage(attendee, event);
      }

      // Send via Z-API
      try {
        const cleanPhone = attendee.phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (CLIENT_TOKEN) headers["Client-Token"] = CLIENT_TOKEN;

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: formattedPhone, message }),
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          results.push({ name: attendee.name, phone: attendee.phone, success: false, error: data.error || data.message || "Erro envio" });
        } else {
          results.push({ name: attendee.name, phone: attendee.phone, success: true });
        }

        // Delay between messages
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        results.push({ name: attendee.name, phone: attendee.phone, success: false, error: e instanceof Error ? e.message : "Erro" });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("event-whatsapp-confirm error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateMessage(attendee: Attendee, event: EventDetails, apiKey?: string | null): Promise<string> {
  if (!apiKey) throw new Error("No API key");

  const isCloser = attendee.type === "closer";
  const prompt = isCloser
    ? `Gere uma mensagem curta e profissional de confirmação de reunião via WhatsApp para um CLOSER (membro da equipe de vendas).
Nome do closer: ${attendee.name}
Reunião: ${event.title}
Data: ${event.date}
Horário: ${event.startTime} às ${event.endTime}
${event.description ? `Detalhes: ${event.description}` : ""}
Organizado por: ${event.organizerName}

A mensagem deve:
- Ser objetiva e motivacional
- Incluir data, horário e nome da reunião
- Usar no máximo 2 emojis
- Ter no máximo 3 linhas
- Não usar saudações formais excessivas`
    : `Gere uma mensagem curta e profissional de confirmação de reunião via WhatsApp para um CLIENTE.
Nome do cliente: ${attendee.name}
Reunião: ${event.title}
Data: ${event.date}
Horário: ${event.startTime} às ${event.endTime}
${event.description ? `Detalhes: ${event.description}` : ""}
Empresa/Responsável: ${event.organizerName}

A mensagem deve:
- Ser educada e acolhedora
- Incluir data, horário e assunto da reunião
- Usar no máximo 2 emojis
- Ter no máximo 4 linhas
- Transmitir profissionalismo`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Você é um assistente que gera mensagens de WhatsApp para confirmação de reuniões. Responda APENAS com a mensagem, sem aspas, sem explicações." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) throw new Error("AI generation failed");
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || buildFallbackMessage(attendee, event);
}

function buildFallbackMessage(attendee: Attendee, event: EventDetails): string {
  if (attendee.type === "closer") {
    return `📅 *Reunião confirmada!*\n\n${attendee.name}, sua reunião "${event.title}" está agendada para ${event.date} das ${event.startTime} às ${event.endTime}.\n\nBoa reunião! 🚀`;
  }
  return `📅 *Confirmação de Reunião*\n\nOlá ${attendee.name}! Sua reunião "${event.title}" está confirmada para ${event.date} das ${event.startTime} às ${event.endTime}.\n\nQualquer dúvida, estamos à disposição.`;
}
