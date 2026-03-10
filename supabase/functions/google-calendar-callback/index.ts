import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(redirectHtml("Autorização negada"), { headers: { "Content-Type": "text/html" } });
    }

    if (!code || !stateParam) {
      return new Response(redirectHtml("Parâmetros inválidos"), { headers: { "Content-Type": "text/html" } });
    }

    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenData);
      return new Response(redirectHtml("Erro ao trocar código por token"), { headers: { "Content-Type": "text/html" } });
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const state = JSON.parse(atob(stateParam));
    const userId = state.userId;

    // Get user email from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // Store tokens using service role
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("google_calendar_tokens")
      .upsert({
        user_id: userId,
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        calendar_email: userInfo.email || null,
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(redirectHtml("Erro ao salvar token"), { headers: { "Content-Type": "text/html" } });
    }

    return new Response(redirectHtml(null), { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    console.error("Callback error:", e);
    return new Response(redirectHtml("Erro interno"), { headers: { "Content-Type": "text/html" } });
  }
});

function redirectHtml(error: string | null): string {
  const message = error ? `Erro: ${error}` : "Google Calendar conectado com sucesso!";
  const appUrl = error ? "/" : "/?gcal=success";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google Calendar</title></head><body>
    <p>${message}</p>
    <p>Redirecionando...</p>
    <script>setTimeout(() => window.location.href = "${appUrl}", 2000);</script>
  </body></html>`;
}
