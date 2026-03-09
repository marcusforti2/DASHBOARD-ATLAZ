import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Triggered when a deal enters the first stage in Pipedrive.
 * Creates/finds WhatsApp conversation and activates SDR IA proactively.
 * 
 * Can be called:
 * 1. Via Pipedrive webhook (deal.updated with stage change)
 * 2. Manually from the UI
 * 3. Via pipedrive-webhook edge function forwarding
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { deal_id, person_name, person_phone, instance_id } = await req.json();

    if (!person_phone) {
      return new Response(JSON.stringify({ error: "No phone number provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
    const cleanPhone = person_phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the instance to use (provided or first with AI SDR enabled)
    let targetInstance: any;
    if (instance_id) {
      const { data } = await supabase
        .from("wa_instances")
        .select("*")
        .eq("id", instance_id)
        .eq("ai_sdr_enabled", true)
        .single();
      targetInstance = data;
    } else {
      const { data } = await supabase
        .from("wa_instances")
        .select("*")
        .eq("ai_sdr_enabled", true)
        .eq("is_connected", true)
        .limit(1)
        .single();
      targetInstance = data;
    }

    if (!targetInstance) {
      return new Response(JSON.stringify({ error: "No AI SDR instance available" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create contact
    let contact: any;
    const { data: existingContact } = await supabase
      .from("wa_contacts")
      .select("id")
      .eq("instance_id", targetInstance.id)
      .or(`phone.eq.${cleanPhone},phone.like.%${cleanPhone.slice(-9)}`)
      .limit(1)
      .single();

    if (existingContact) {
      contact = existingContact;
    } else {
      const { data: newContact, error: contactErr } = await supabase
        .from("wa_contacts")
        .insert({
          instance_id: targetInstance.id,
          phone: cleanPhone,
          name: person_name || cleanPhone,
        })
        .select()
        .single();

      if (contactErr) throw new Error(`Contact creation failed: ${contactErr.message}`);
      contact = newContact;
    }

    // Find or create conversation
    let conversationId: string;
    const { data: existingConv } = await supabase
      .from("wa_conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("instance_id", targetInstance.id)
      .limit(1)
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from("wa_conversations")
        .insert({
          contact_id: contact.id,
          instance_id: targetInstance.id,
          lead_status: "novo",
          status: "open",
        })
        .select()
        .single();

      if (convErr) throw new Error(`Conversation creation failed: ${convErr.message}`);
      conversationId = newConv.id;
    }

    // Call ai-sdr-agent with proactive trigger
    const aiSdrResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-sdr-agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        instance_id: targetInstance.id,
        contact_phone: cleanPhone,
        instance_name: targetInstance.instance_name,
        contact_name: person_name || "",
        incoming_message: "",
        trigger_type: "proactive",
      }),
    });

    const aiSdrResult = await aiSdrResp.json();
    console.log("[pipedrive-sdr-trigger] AI SDR result:", aiSdrResult);

    // Update conversation status
    await supabase.from("wa_conversations").update({
      lead_status: "em_contato",
    }).eq("id", conversationId);

    return new Response(JSON.stringify({
      ok: true,
      conversation_id: conversationId,
      contact_id: contact.id,
      ai_result: aiSdrResult,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[pipedrive-sdr-trigger] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
