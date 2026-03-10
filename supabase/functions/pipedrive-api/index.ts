import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check admin role
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const PIPEDRIVE_API_TOKEN = Deno.env.get('PIPEDRIVE_API_TOKEN');
  if (!PIPEDRIVE_API_TOKEN) {
    return new Response(JSON.stringify({ error: 'PIPEDRIVE_API_TOKEN not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { action, params } = body;

    let result;

    switch (action) {
      case 'get_deals':
        result = await pipedriveGet('/deals', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_deal':
        result = await pipedriveGet(`/deals/${params.id}`, {}, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_persons':
        result = await pipedriveGet('/persons', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_person':
        result = await pipedriveGet(`/persons/${params.id}`, {}, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_activities':
        result = await pipedriveGet('/activities', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_pipelines':
        result = await pipedriveGet('/pipelines', {}, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_stages':
        result = await pipedriveGet('/stages', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_deal_flow':
        result = await pipedriveGet(`/deals/${params.id}/flow`, {}, PIPEDRIVE_API_TOKEN);
        break;
      case 'create_deal':
        result = await pipedrivePost('/deals', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'update_deal':
        result = await pipedrivePut(`/deals/${params.id}`, params, PIPEDRIVE_API_TOKEN);
        break;
      case 'create_person':
        result = await pipedrivePost('/persons', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'create_activity':
        result = await pipedrivePost('/activities', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'create_note':
        result = await pipedrivePost('/notes', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'sync_all':
        result = await syncAll(supabase, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_webhooks':
        result = await pipedriveGet('/webhooks', {}, PIPEDRIVE_API_TOKEN);
        break;
      case 'create_webhook':
        result = await pipedrivePost('/webhooks', params, PIPEDRIVE_API_TOKEN);
        break;
      case 'delete_webhook':
        result = await pipedriveDelete(`/webhooks/${params.id}`, PIPEDRIVE_API_TOKEN);
        break;
      case 'get_deal_fields':
        result = await pipedriveGet('/dealFields', params || {}, PIPEDRIVE_API_TOKEN);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[pipedrive-api] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function pipedriveGet(path: string, params: Record<string, any>, token: string) {
  const url = new URL(`${PIPEDRIVE_BASE}${path}`);
  url.searchParams.set('api_token', token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const resp = await fetch(url.toString());
  return await resp.json();
}

async function pipedrivePost(path: string, data: Record<string, any>, token: string) {
  const url = `${PIPEDRIVE_BASE}${path}?api_token=${token}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await resp.json();
}

async function pipedrivePut(path: string, data: Record<string, any>, token: string) {
  const url = `${PIPEDRIVE_BASE}${path}?api_token=${token}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await resp.json();
}

async function pipedriveDelete(path: string, token: string) {
  const url = `${PIPEDRIVE_BASE}${path}?api_token=${token}`;
  const resp = await fetch(url, { method: 'DELETE' });
  return await resp.json();
}

async function syncAll(supabase: any, token: string) {
  const results = { deals: 0, persons: 0, activities: 0 };

  // Sync deals
  let start = 0;
  let moreDeals = true;
  while (moreDeals) {
    const res = await pipedriveGet('/deals', { start, limit: 100, status: 'all_not_deleted' }, token);
    if (res.data && Array.isArray(res.data)) {
      for (const d of res.data) {
        await supabase.from('pipedrive_deals').upsert({
          pipedrive_id: d.id,
          title: d.title || '',
          person_name: d.person_name || null,
          person_id: d.person_id?.value || d.person_id || null,
          org_name: d.org_name || null,
          status: d.status || 'open',
          value: d.value || 0,
          currency: d.currency || 'BRL',
          won_time: d.won_time || null,
          lost_time: d.lost_time || null,
          close_time: d.close_time || null,
          lost_reason: d.lost_reason || null,
          raw_data: d,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'pipedrive_id' });
        results.deals++;
      }
    }
    moreDeals = res.additional_data?.pagination?.more_items_in_collection || false;
    start = res.additional_data?.pagination?.next_start || 0;
  }

  // Sync persons
  start = 0;
  let morePersons = true;
  while (morePersons) {
    const res = await pipedriveGet('/persons', { start, limit: 100 }, token);
    if (res.data && Array.isArray(res.data)) {
      for (const p of res.data) {
        const phone = Array.isArray(p.phone) ? p.phone[0]?.value : null;
        const email = Array.isArray(p.email) ? p.email[0]?.value : null;
        await supabase.from('pipedrive_persons').upsert({
          pipedrive_id: p.id,
          name: p.name || '',
          email,
          phone,
          org_name: p.org_name || null,
          raw_data: p,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'pipedrive_id' });
        results.persons++;
      }
    }
    morePersons = res.additional_data?.pagination?.more_items_in_collection || false;
    start = res.additional_data?.pagination?.next_start || 0;
  }

  return { ok: true, synced: results };
}
