import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { token, email, password, full_name } = await req.json();
    if (!token) throw new Error("Token de convite é obrigatório");
    if (!email || !password) throw new Error("Email e senha são obrigatórios");
    if (password.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");

    // Validate token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("admin_invites")
      .select("*")
      .eq("token", token)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      throw new Error("Convite inválido, já utilizado ou expirado");
    }

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (createError) throw new Error(createError.message);

    // Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user!.id, role: "admin" });

    if (roleError) throw new Error(roleError.message);

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: full_name || email })
      .eq("id", newUser.user!.id);

    // Mark invite as used
    await supabaseAdmin
      .from("admin_invites")
      .update({ used_by: newUser.user!.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

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
