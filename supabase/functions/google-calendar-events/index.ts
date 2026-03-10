import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = req.method === "POST" ? await req.json() : {};
    const action = body.action || "list";

    // ── Action: list connected closers (any authenticated user) ──
    if (action === "list_connected_closers") {
      return await handleListConnectedClosers(serviceClient);
    }

    // ── Action: list_connections (admin only) ──
    if (action === "list_connections") {
      return await handleListConnections(serviceClient, user.id);
    }

    // Determine whose calendar to access
    // Any authenticated user can view a closer's calendar
    const targetUserId = body.targetUserId || user.id;

    // Get tokens for target user
    const { data: tokenRow, error: tokenError } = await serviceClient
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: "not_connected", message: "Google Calendar não conectado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    if (new Date(tokenRow.token_expires_at) <= new Date()) {
      accessToken = await refreshAccessToken(tokenRow.refresh_token, serviceClient, targetUserId);
    }

    if (action === "list") {
      return await handleListEvents(accessToken, body);
    }

    if (action === "create") {
      return await handleCreateEvent(accessToken, body);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("google-calendar-events error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Handlers ──

async function handleListConnectedClosers(serviceClient: ReturnType<typeof createClient>) {
  // Get all closers
  const { data: members } = await serviceClient
    .from("team_members")
    .select("id, name, member_role")
    .eq("active", true)
    .order("name");

  const closers = (members || []).filter(m => {
    const roles = (m.member_role || "").split(",").map((r: string) => r.trim());
    return roles.includes("closer");
  });

  // Get profiles linked to these closers
  const closerIds = closers.map(c => c.id);
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, team_member_id")
    .in("team_member_id", closerIds.length > 0 ? closerIds : ["none"]);

  // Get tokens
  const userIds = profiles?.map(p => p.id) || [];
  const { data: tokens } = await serviceClient
    .from("google_calendar_tokens")
    .select("user_id, calendar_email")
    .in("user_id", userIds.length > 0 ? userIds : ["none"]);

  const result = closers.map(closer => {
    const profile = profiles?.find(p => p.team_member_id === closer.id);
    const token = profile ? tokens?.find(t => t.user_id === profile.id) : null;
    return {
      memberId: closer.id,
      memberName: closer.name,
      memberRole: closer.member_role,
      userId: profile?.id || null,
      connected: !!token,
      calendarEmail: token?.calendar_email || null,
    };
  });

  return new Response(JSON.stringify({ closers: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleListConnections(serviceClient: ReturnType<typeof createClient>, requesterId: string) {
  const { data: adminRole } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", requesterId)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) throw new Error("Unauthorized: admin access required");

  const { data: tokens } = await serviceClient
    .from("google_calendar_tokens")
    .select("user_id, calendar_email, created_at");

  const userIds = tokens?.map(t => t.user_id) || [];
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, full_name, team_member_id")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const { data: members } = await serviceClient
    .from("team_members")
    .select("id, name, member_role, active")
    .eq("active", true);

  const connections = (members || []).filter(member => {
    const roles = (member.member_role || "").split(",").map((r: string) => r.trim());
    return roles.includes("closer");
  }).map(member => {
    const profile = profiles?.find(p => p.team_member_id === member.id);
    const token = profile ? tokens?.find(t => t.user_id === profile.id) : null;
    return {
      memberId: member.id,
      memberName: member.name,
      memberRole: member.member_role,
      userId: profile?.id || null,
      connected: !!token,
      calendarEmail: token?.calendar_email || null,
      connectedAt: token?.created_at || null,
    };
  });

  return new Response(JSON.stringify({ connections }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleListEvents(accessToken: string, body: Record<string, unknown>) {
  const timeMin = (body.timeMin as string) || new Date().toISOString();
  const timeMax = (body.timeMax as string) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const calUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  calUrl.searchParams.set("timeMin", timeMin);
  calUrl.searchParams.set("timeMax", timeMax);
  calUrl.searchParams.set("singleEvents", "true");
  calUrl.searchParams.set("orderBy", "startTime");
  calUrl.searchParams.set("maxResults", "50");

  const res = await fetch(calUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google API error: ${JSON.stringify(data)}`);

  return new Response(JSON.stringify({ events: data.items || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCreateEvent(accessToken: string, body: Record<string, unknown>) {
  const { summary, description, startDateTime, endDateTime, attendees, addMeet } = body as {
    summary?: string; description?: string; startDateTime?: string; endDateTime?: string;
    attendees?: string[]; addMeet?: boolean;
  };
  if (!summary || !startDateTime || !endDateTime) throw new Error("Missing required fields");

  const event: Record<string, unknown> = {
    summary,
    description: description || "",
    start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
    end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
  };
  if (attendees?.length) {
    event.attendees = attendees.map((email: string) => ({ email }));
  }
  if (addMeet !== false) {
    event.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const createUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1";
  const res = await fetch(createUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google API error: ${JSON.stringify(data)}`);

  return new Response(JSON.stringify({ event: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshAccessToken(refreshToken: string, serviceClient: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await serviceClient
    .from("google_calendar_tokens")
    .update({ access_token: data.access_token, token_expires_at: expiresAt })
    .eq("user_id", userId);

  return data.access_token;
}
