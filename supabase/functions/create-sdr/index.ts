import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (!isAdmin) throw new Error("Apenas admins podem criar SDRs");

    const { name, email, password, member_role } = await req.json();
    const role = member_role === "closer" ? "closer" : "sdr";
    if (!name?.trim()) throw new Error("Nome é obrigatório");
    if (!email?.trim()) throw new Error("Email é obrigatório");
    if (!password || password.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");

    // 1. Create team_member
    const { data: teamMember, error: tmError } = await supabaseAdmin
      .from("team_members")
      .insert({ name: name.trim(), member_role: role })
      .select("id")
      .single();

    if (tmError) throw new Error("Erro ao criar membro: " + tmError.message);

    // 2. Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: name.trim() },
    });

    if (createError) {
      // Rollback team member
      await supabaseAdmin.from("team_members").delete().eq("id", teamMember.id);
      throw new Error(createError.message);
    }

    const userId = newUser.user!.id;

    // 3. Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from("team_members").delete().eq("id", teamMember.id);
      throw new Error("Erro ao atribuir papel: " + roleError.message);
    }

    // 4. Link profile to team_member
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: name.trim(), team_member_id: teamMember.id })
      .eq("id", userId);

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userId, 
      team_member_id: teamMember.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
