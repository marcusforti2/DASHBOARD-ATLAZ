import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELAY_BETWEEN_SENDS_MS = 15_000; // 15 seconds between each trigger

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queue processor for Pipedrive SDR proactive outreach.
 * Processes pending items one by one with 15s delay between each.
 * Called by pg_cron every minute.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get pending items ordered by creation time (FIFO)
    const { data: pendingItems, error: fetchErr } = await supabase
      .from("pipedrive_sdr_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(4); // Max 4 per minute (4 x 15s = 60s)

    if (fetchErr) throw fetchErr;

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No pending items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[pipedrive-sdr-trigger] Processing ${pendingItems.length} queued items`);

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];

      // Mark as processing
      await supabase
        .from("pipedrive_sdr_queue")
        .update({ status: "processing", attempts: (item.attempts || 0) + 1 })
        .eq("id", item.id);

      try {
        console.log(`[pipedrive-sdr-trigger] Processing item ${i + 1}/${pendingItems.length}: deal ${item.deal_pipedrive_id} → ${item.person_name} (${item.person_phone})`);

        // Call ai-sdr-agent with proactive trigger
        const aiSdrResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-sdr-agent`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: item.conversation_id,
            instance_id: item.instance_id,
            contact_phone: item.person_phone,
            instance_name: item.instance_name,
            contact_name: item.person_name || "",
            incoming_message: "",
            trigger_type: "proactive",
            pipedrive_context: item.pipedrive_context || {},
          }),
        });

        const aiSdrResult = await aiSdrResp.json();
        console.log(`[pipedrive-sdr-trigger] ✅ AI SDR result for deal ${item.deal_pipedrive_id}:`, JSON.stringify(aiSdrResult).slice(0, 200));

        // Mark as done
        await supabase
          .from("pipedrive_sdr_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        processed++;
      } catch (itemErr) {
        const errMsg = itemErr instanceof Error ? itemErr.message : "Unknown error";
        console.error(`[pipedrive-sdr-trigger] ❌ Error processing deal ${item.deal_pipedrive_id}:`, errMsg);

        // Mark as failed (will retry if attempts < 3)
        const newStatus = (item.attempts || 0) + 1 >= 3 ? "failed" : "pending";
        await supabase
          .from("pipedrive_sdr_queue")
          .update({
            status: newStatus,
            error: errMsg,
          })
          .eq("id", item.id);

        errors++;
      }

      // Wait 15 seconds before processing next item (except for the last one)
      if (i < pendingItems.length - 1) {
        console.log(`[pipedrive-sdr-trigger] Waiting ${DELAY_BETWEEN_SENDS_MS / 1000}s before next...`);
        await sleep(DELAY_BETWEEN_SENDS_MS);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        errors,
        total: pendingItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[pipedrive-sdr-trigger] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
