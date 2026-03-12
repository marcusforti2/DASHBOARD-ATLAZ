import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 5;

function backoffMs(retryCount: number): number {
  // Exponential: 30s, 60s, 120s, 240s, 480s
  return Math.min(30000 * Math.pow(2, retryCount), 600000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    // Claim batch using FOR UPDATE SKIP LOCKED via DB function
    const { data: actions, error: claimErr } = await supabase.rpc(
      "claim_automation_actions",
      { batch_size: 10, worker_id: workerId }
    );

    if (claimErr) {
      console.error("[queue] Claim error:", claimErr);
      return new Response(JSON.stringify({ error: claimErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!actions?.length) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No actions ready" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[queue] Claimed ${actions.length} actions (worker: ${workerId})`);

    let executed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const action of actions) {
      try {
        // Check if enrollment is still active
        const { data: enrollment } = await supabase
          .from("campaign_enrollments")
          .select("status, conversation_id")
          .eq("id", action.enrollment_id)
          .single();

        if (!enrollment || enrollment.status !== "active") {
          await supabase
            .from("automation_actions")
            .update({
              status: "cancelled",
              last_error: `enrollment_status: ${enrollment?.status || "not_found"}`,
              executed_at: new Date().toISOString(),
            })
            .eq("id", action.id);
          cancelled++;
          continue;
        }

        // Check suppression
        const { data: contact } = await supabase
          .from("wa_contacts")
          .select("phone")
          .eq("id", action.contact_id)
          .single();

        if (contact) {
          const normalPhone = contact.phone.replace(/\D/g, "");
          const { data: suppressed } = await supabase
            .from("contact_suppressions")
            .select("id")
            .eq("phone", normalPhone)
            .maybeSingle();

          if (suppressed) {
            // Cancel all pending actions for this enrollment
            await supabase
              .from("automation_actions")
              .update({
                status: "cancelled",
                last_error: "contact_suppressed",
                executed_at: new Date().toISOString(),
              })
              .eq("enrollment_id", action.enrollment_id)
              .in("status", ["pending", "locked"]);

            await supabase
              .from("campaign_enrollments")
              .update({ status: "opted_out", cancelled_at: new Date().toISOString(), cancel_reason: "suppressed" })
              .eq("id", action.enrollment_id);

            cancelled++;
            continue;
          }
        }

        // Execute action based on type
        await executeAction(supabase, action, enrollment, SUPABASE_URL, SERVICE_KEY);

        // Mark as executed
        await supabase
          .from("automation_actions")
          .update({
            status: "executed",
            executed_at: new Date().toISOString(),
            locked_at: null,
            locked_by: null,
          })
          .eq("id", action.id);

        // Advance enrollment step
        await supabase
          .from("campaign_enrollments")
          .update({ current_step: action.step_index + 1 })
          .eq("id", action.enrollment_id);

        executed++;
      } catch (actionErr: unknown) {
        const errMsg = actionErr instanceof Error ? actionErr.message : String(actionErr);
        console.error(`[queue] Action ${action.id} failed:`, errMsg);

        const newRetry = (action.retry_count || 0) + 1;

        if (newRetry >= MAX_RETRIES) {
          // Exhausted retries
          await supabase
            .from("automation_actions")
            .update({
              status: "failed",
              last_error: errMsg,
              retry_count: newRetry,
              locked_at: null,
              locked_by: null,
              executed_at: new Date().toISOString(),
            })
            .eq("id", action.id);
        } else {
          // Schedule retry with exponential backoff
          const nextRun = new Date(Date.now() + backoffMs(newRetry)).toISOString();
          await supabase
            .from("automation_actions")
            .update({
              status: "failed",
              last_error: errMsg,
              retry_count: newRetry,
              scheduled_for: nextRun,
              locked_at: null,
              locked_by: null,
            })
            .eq("id", action.id);
        }

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: actions.length, executed, failed, cancelled }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[queue] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Action executor ────────────────────────────────────────────

async function executeAction(
  supabase: any,
  action: any,
  enrollment: any,
  supabaseUrl: string,
  serviceKey: string
) {
  const { action_type, action_payload, contact_id } = action;

  switch (action_type) {
    case "send_message": {
      const { data: contact } = await supabase
        .from("wa_contacts")
        .select("phone, instance_id")
        .eq("id", contact_id)
        .single();

      if (!contact) throw new Error("Contact not found");

      const { data: inst } = await supabase
        .from("wa_instances")
        .select("instance_name")
        .eq("id", contact.instance_id)
        .single();

      if (!inst) throw new Error("Instance not found");

      const message = action_payload.message || action_payload.text || "";
      if (!message) throw new Error("No message in payload");

      // Send via evolution-api edge function
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/evolution-api?instance=${inst.instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            action: "sendText",
            number: contact.phone,
            text: message,
          }),
        }
      );

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`send_message failed: ${resp.status} ${errBody.substring(0, 200)}`);
      }

      console.log(`[queue] Sent message to ${contact.phone}`);
      break;
    }

    case "tag": {
      const tagId = action_payload.tag_id;
      if (tagId) {
        await supabase.from("wa_contact_tags").upsert(
          { contact_id, tag_id: tagId },
          { onConflict: "contact_id,tag_id", ignoreDuplicates: true }
        );
      }
      break;
    }

    case "handoff": {
      if (enrollment.conversation_id) {
        await supabase
          .from("wa_conversations")
          .update({
            conversation_mode: "humano_assumiu",
            human_takeover_at: new Date().toISOString(),
            handoff_reason: action_payload.reason || "campaign_handoff",
          })
          .eq("id", enrollment.conversation_id);
      }

      await supabase
        .from("campaign_enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", action.enrollment_id);
      break;
    }

    case "wait":
      // Wait actions are handled by scheduled_for timing, just pass through
      break;

    default:
      console.log(`[queue] Unknown action_type: ${action_type}, skipping`);
  }
}
