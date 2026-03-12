import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { campaign_id, contact_ids } = await req.json();
    if (!campaign_id || !Array.isArray(contact_ids) || !contact_ids.length) {
      return new Response(
        JSON.stringify({ error: "campaign_id and contact_ids[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const steps: any[] = campaign.steps || [];
    if (!steps.length) {
      return new Response(
        JSON.stringify({ error: "Campaign has no steps" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contacts with phones for suppression check
    const { data: contacts } = await supabase
      .from("wa_contacts")
      .select("id, phone")
      .in("id", contact_ids);

    if (!contacts?.length) {
      return new Response(
        JSON.stringify({ error: "No valid contacts found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch suppressions to filter out opted-out contacts
    const normalizedPhones = contacts.map((c) => c.phone.replace(/\D/g, ""));
    const { data: suppressions } = await supabase
      .from("contact_suppressions")
      .select("phone")
      .in("phone", normalizedPhones);

    const suppressedSet = new Set((suppressions || []).map((s) => s.phone));
    const eligibleContacts = contacts.filter(
      (c) => !suppressedSet.has(c.phone.replace(/\D/g, ""))
    );

    console.log(
      `[dispatch] Campaign ${campaign.name}: ${contacts.length} contacts, ${eligibleContacts.length} eligible, ${suppressedSet.size} suppressed`
    );

    let enrolled = 0;
    let skippedDup = 0;
    let actionsCreated = 0;

    for (const contact of eligibleContacts) {
      // Find conversation for this contact + instance
      const { data: conv } = await supabase
        .from("wa_conversations")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("instance_id", campaign.instance_id)
        .maybeSingle();

      // Insert enrollment (ON CONFLICT skip = idempotent)
      const { data: enrollment, error: eErr } = await supabase
        .from("campaign_enrollments")
        .upsert(
          {
            campaign_id,
            contact_id: contact.id,
            conversation_id: conv?.id || null,
            status: "active",
          },
          { onConflict: "campaign_id,contact_id", ignoreDuplicates: true }
        )
        .select("id, status")
        .single();

      if (eErr) {
        // Duplicate — already enrolled
        skippedDup++;
        continue;
      }

      // Only create actions for newly enrolled (active) enrollments
      if (enrollment.status !== "active") {
        skippedDup++;
        continue;
      }

      enrolled++;

      // Create automation actions for each step
      let cumulativeDelayMs = 0;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const delayMs = (step.delay_minutes || 0) * 60000;
        cumulativeDelayMs += delayMs;

        const scheduledFor = new Date(Date.now() + cumulativeDelayMs).toISOString();

        await supabase.from("automation_actions").insert({
          enrollment_id: enrollment.id,
          campaign_id,
          contact_id: contact.id,
          step_index: i,
          action_type: step.action_type || "send_message",
          action_payload: step.payload || {},
          status: "pending",
          scheduled_for: scheduledFor,
        });
        actionsCreated++;
      }
    }

    // Activate campaign if still draft
    if (campaign.status === "draft") {
      await supabase
        .from("campaigns")
        .update({ status: "active" })
        .eq("id", campaign_id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        enrolled,
        skipped_duplicate: skippedDup,
        skipped_suppressed: contacts.length - eligibleContacts.length,
        actions_created: actionsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[dispatch] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
