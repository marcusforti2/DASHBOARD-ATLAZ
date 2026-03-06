import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Check admin role
    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Unauthorized: admin only");

    // Get admin's Google tokens
    const accessToken = await getAccessToken(serviceClient, user.id);

    const body = await req.json();
    const { action } = body;

    if (action === "create_folders") {
      return await handleCreateFolders(serviceClient, accessToken, body);
    }

    if (action === "sync_videos") {
      return await handleSyncVideos(serviceClient, accessToken, body);
    }

    if (action === "check_connection") {
      return json({ connected: true });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("google-drive-training error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("not_connected") ? 401 : msg.includes("Unauthorized") ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Get access token (with refresh) ──
async function getAccessToken(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: tokenRow, error } = await serviceClient
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) throw new Error("not_connected");

  if (new Date(tokenRow.token_expires_at) <= new Date()) {
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
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

  return tokenRow.access_token;
}

// ── Create Drive folder ──
async function createDriveFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive API error: ${JSON.stringify(data)}`);
  return data.id;
}

// ── Create full folder structure for a course ──
async function handleCreateFolders(
  serviceClient: ReturnType<typeof createClient>,
  accessToken: string,
  body: Record<string, unknown>
) {
  const { courseId } = body as { courseId: string };
  if (!courseId) throw new Error("courseId required");

  // Get course
  const { data: course } = await serviceClient
    .from("training_courses")
    .select("id, title, drive_folder_id")
    .eq("id", courseId)
    .single();
  if (!course) throw new Error("Course not found");

  // Find or create root "Treinamentos" folder
  let rootFolderId = await findOrCreateRootFolder(accessToken);

  // Create course folder if not exists
  let courseFolderId = course.drive_folder_id;
  if (!courseFolderId) {
    courseFolderId = await createDriveFolder(accessToken, `📚 ${course.title}`, rootFolderId);
    await serviceClient.from("training_courses").update({ drive_folder_id: courseFolderId }).eq("id", courseId);
  }

  // Get modules
  const { data: modules } = await serviceClient
    .from("training_modules")
    .select("id, title, sort_order, drive_folder_id")
    .eq("course_id", courseId)
    .order("sort_order");

  const createdFolders: { type: string; name: string; folderId: string }[] = [
    { type: "course", name: course.title, folderId: courseFolderId },
  ];

  for (const mod of modules || []) {
    let modFolderId = mod.drive_folder_id;
    if (!modFolderId) {
      modFolderId = await createDriveFolder(accessToken, `📖 ${mod.title}`, courseFolderId);
      await serviceClient.from("training_modules").update({ drive_folder_id: modFolderId }).eq("id", mod.id);
    }
    createdFolders.push({ type: "module", name: mod.title, folderId: modFolderId });

    // Get lessons for this module
    const { data: lessons } = await serviceClient
      .from("training_lessons")
      .select("id, title, sort_order, drive_folder_id")
      .eq("module_id", mod.id)
      .order("sort_order");

    for (const lesson of lessons || []) {
      let lessonFolderId = lesson.drive_folder_id;
      if (!lessonFolderId) {
        lessonFolderId = await createDriveFolder(accessToken, `🎬 ${lesson.title}`, modFolderId);
        await serviceClient.from("training_lessons").update({ drive_folder_id: lessonFolderId }).eq("id", lesson.id);
      }
      createdFolders.push({ type: "lesson", name: lesson.title, folderId: lessonFolderId });
    }
  }

  return json({ success: true, folders: createdFolders });
}

// ── Find or create root "Treinamentos" folder ──
async function findOrCreateRootFolder(accessToken: string): Promise<string> {
  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", "name='📁 Treinamentos' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  searchUrl.searchParams.set("fields", "files(id,name)");
  searchUrl.searchParams.set("spaces", "drive");

  const res = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  if (data.files?.length > 0) return data.files[0].id;

  return await createDriveFolder(accessToken, "📁 Treinamentos");
}

// ── Sync videos from Drive folders to lessons ──
async function handleSyncVideos(
  serviceClient: ReturnType<typeof createClient>,
  accessToken: string,
  body: Record<string, unknown>
) {
  const { courseId } = body as { courseId: string };
  if (!courseId) throw new Error("courseId required");

  // Get all lessons with drive_folder_id for this course
  const { data: modules } = await serviceClient
    .from("training_modules")
    .select("id")
    .eq("course_id", courseId);

  const moduleIds = (modules || []).map(m => m.id);
  if (moduleIds.length === 0) return json({ synced: 0 });

  const { data: lessons } = await serviceClient
    .from("training_lessons")
    .select("id, title, drive_folder_id, video_url, video_type")
    .in("module_id", moduleIds);

  let synced = 0;
  const updates: { lessonId: string; lessonTitle: string; videoName: string; videoUrl: string }[] = [];

  for (const lesson of lessons || []) {
    if (!lesson.drive_folder_id) continue;

    // List video files in the lesson folder
    const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
    searchUrl.searchParams.set("q", `'${lesson.drive_folder_id}' in parents and mimeType contains 'video/' and trashed=false`);
    searchUrl.searchParams.set("fields", "files(id,name,mimeType,webViewLink,webContentLink)");
    searchUrl.searchParams.set("orderBy", "createdTime desc");
    searchUrl.searchParams.set("pageSize", "1");

    const res = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (data.files?.length > 0) {
      const file = data.files[0];
      const driveUrl = `https://drive.google.com/file/d/${file.id}/preview`;

      // Only update if no video set yet or if it was a placeholder
      if (!lesson.video_url || lesson.video_url === "" || lesson.video_url === "#") {
        await serviceClient
          .from("training_lessons")
          .update({ video_url: driveUrl, video_type: "drive" })
          .eq("id", lesson.id);

        // Make file viewable by anyone with link
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        });

        synced++;
        updates.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          videoName: file.name,
          videoUrl: driveUrl,
        });
      }
    }
  }

  return json({ synced, updates });
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
