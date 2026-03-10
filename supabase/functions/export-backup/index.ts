import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES_TO_BACKUP = [
  "team_members",
  "daily_metrics",
  "monthly_goals",
  "weekly_goals",
  "months",
  "lead_entries",
  "company_knowledge",
  "closer_analyses",
  "training_courses",
  "training_modules",
  "training_lessons",
  "training_playbooks",
  "process_flows",
  "whatsapp_automations",
  "whatsapp_contacts",
  "motivational_popups",
  "coach_conversations",
  "coach_messages",
  "ai_tool_usage",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admins podem fazer backup" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const folderName = `backup-${now.toISOString().replace(/[:.]/g, "-")}`;
    const manifest: Record<string, number> = {};

    for (const table of TABLES_TO_BACKUP) {
      try {
        let allRows: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .range(from, from + pageSize - 1);

          if (error) {
            console.warn(`Error backing up ${table}:`, error.message);
            break;
          }
          if (!data || data.length === 0) break;
          allRows = [...allRows, ...data];
          if (data.length < pageSize) break;
          from += pageSize;
        }

        const jsonContent = JSON.stringify(allRows, null, 2);
        const filePath = `${folderName}/${table}.json`;

        await supabase.storage
          .from("data-backups")
          .upload(filePath, new Blob([jsonContent], { type: "application/json" }), {
            contentType: "application/json",
            upsert: false,
          });

        manifest[table] = allRows.length;
      } catch (e) {
        console.warn(`Failed to backup ${table}:`, e);
        manifest[table] = -1;
      }
    }

    // Save manifest
    const manifestContent = JSON.stringify({
      timestamp: now.toISOString(),
      tables: manifest,
      total_rows: Object.values(manifest).filter(v => v >= 0).reduce((a, b) => a + b, 0),
    }, null, 2);

    await supabase.storage
      .from("data-backups")
      .upload(`${folderName}/_manifest.json`, new Blob([manifestContent], { type: "application/json" }), {
        contentType: "application/json",
      });

    return new Response(JSON.stringify({
      success: true,
      folder: folderName,
      tables: manifest,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Backup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
