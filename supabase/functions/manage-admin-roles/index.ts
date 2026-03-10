import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas admins podem gerenciar funções");

    const { admin_user_id, add_roles, remove_roles } = await req.json();
    if (!admin_user_id) throw new Error("admin_user_id é obrigatório");

    // Verify target is actually an admin
    const { data: targetIsAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: admin_user_id, _role: "admin" });
    if (!targetIsAdmin) throw new Error("Usuário alvo não é admin");

    // Get profile
    const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", admin_user_id).single();
    if (!profile) throw new Error("Perfil não encontrado");

    // Add roles
    if (add_roles?.length) {
      for (const role of add_roles) {
        if (!["sdr", "closer"].includes(role)) continue;
        // Check if already has this role
        const { data: existing } = await supabaseAdmin.from("user_roles")
          .select("id").eq("user_id", admin_user_id).eq("role", role).maybeSingle();
        if (!existing) {
          await supabaseAdmin.from("user_roles").insert({ user_id: admin_user_id, role });
        }
      }

      // Create team_member if not linked
      if (!profile.team_member_id) {
        const memberRole = add_roles.filter((r: string) => ["sdr", "closer"].includes(r)).join(",");
        const { data: tm, error: tmErr } = await supabaseAdmin.from("team_members")
          .insert({ name: profile.full_name || "Admin", member_role: memberRole })
          .select("id").single();
        if (tmErr) throw new Error("Erro ao criar membro: " + tmErr.message);
        await supabaseAdmin.from("profiles").update({ team_member_id: tm.id }).eq("id", admin_user_id);
      } else {
        // Update existing team_member role
        const { data: allRoles } = await supabaseAdmin.from("user_roles")
          .select("role").eq("user_id", admin_user_id);
        const nonAdminRoles = (allRoles || []).map((r: any) => r.role).filter((r: string) => r !== "admin");
        if (nonAdminRoles.length > 0) {
          await supabaseAdmin.from("team_members")
            .update({ member_role: nonAdminRoles.join(",") })
            .eq("id", profile.team_member_id);
        }
      }
    }

    // Remove roles
    if (remove_roles?.length) {
      for (const role of remove_roles) {
        if (!["sdr", "closer"].includes(role)) continue;
        await supabaseAdmin.from("user_roles").delete()
          .eq("user_id", admin_user_id).eq("role", role);
      }

      // Update team_member role or unlink if no more roles
      const { data: remainingRoles } = await supabaseAdmin.from("user_roles")
        .select("role").eq("user_id", admin_user_id);
      const nonAdminRoles = (remainingRoles || []).map((r: any) => r.role).filter((r: string) => r !== "admin");

      if (profile.team_member_id) {
        if (nonAdminRoles.length === 0) {
          // Remove team_member link but keep the record
          await supabaseAdmin.from("team_members").update({ active: false }).eq("id", profile.team_member_id);
          await supabaseAdmin.from("profiles").update({ team_member_id: null }).eq("id", admin_user_id);
        } else {
          await supabaseAdmin.from("team_members")
            .update({ member_role: nonAdminRoles.join(","), active: true })
            .eq("id", profile.team_member_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
