import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const payload = await req.json();

    // Support both Pipedrive v1 (meta.object, current) and v2 (meta.entity, data)
    const meta = payload.meta || {};
    const current = payload.current || payload.data || null;
    const previous = payload.previous || null;

    const event = meta.action || 'unknown';
    const entity = meta.entity || meta.object || 'unknown';

    console.log(`[pipedrive-webhook] ${event} ${entity}`, current?.id);

    // Log webhook
    const logEntry = {
      event,
      entity,
      pipedrive_id: current?.id || previous?.id || null,
      payload,
    };
    const { data: logData } = await supabase.from('pipedrive_webhook_logs').insert(logEntry).select('id').single();

    if (entity === 'deal') {
      await handleDeal(supabase, event, current, previous);
    } else if (entity === 'person') {
      await handlePerson(supabase, event, current, previous);
    } else if (entity === 'activity') {
      await handleActivity(supabase, event, current, previous);
    } else if (entity === 'note') {
      await handleNote(supabase, event, current, previous);
    }

    // Mark log as processed
    if (logData?.id) {
      await supabase.from('pipedrive_webhook_logs')
        .update({ processed: true })
        .eq('id', logData.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[pipedrive-webhook] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleDeal(supabase: any, event: string, current: any, previous: any) {
  if (event === 'deleted') {
    await supabase.from('pipedrive_deals').delete().eq('pipedrive_id', previous?.id);
    return;
  }

  const d = current;
  if (!d?.id) return;

  // Try to match with wa_conversation by person phone
  let waConversationId = null;
  let teamMemberId = null;

  if (d.person_id) {
    const { data: person } = await supabase
      .from('pipedrive_persons')
      .select('wa_contact_id')
      .eq('pipedrive_id', d.person_id)
      .single();

    if (person?.wa_contact_id) {
      const { data: conv } = await supabase
        .from('wa_conversations')
        .select('id, assigned_to')
        .eq('contact_id', person.wa_contact_id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      if (conv) {
        waConversationId = conv.id;
        teamMemberId = conv.assigned_to;
      }
    }
  }

  const dealData = {
    pipedrive_id: d.id,
    title: d.title || '',
    person_name: d.person_name || null,
    person_id: d.person_id || null,
    org_name: d.org_name || null,
    stage_name: d.stage_order_nr != null ? `Stage ${d.stage_order_nr}` : (d.stage_name || null),
    pipeline_name: d.pipeline_id ? `Pipeline ${d.pipeline_id}` : null,
    status: d.status || 'open',
    value: d.value || 0,
    currency: d.currency || 'BRL',
    won_time: d.won_time || null,
    lost_time: d.lost_time || null,
    close_time: d.close_time || null,
    lost_reason: d.lost_reason || null,
    owner_name: d.owner_name || null,
    owner_email: d.cc_email || null,
    wa_conversation_id: waConversationId,
    team_member_id: teamMemberId,
    raw_data: d,
    updated_at: new Date().toISOString(),
  };

  await supabase.from('pipedrive_deals').upsert(dealData, { onConflict: 'pipedrive_id' });
  console.log(`[pipedrive-webhook] Deal upserted: ${d.title} (${d.id}) status=${d.status}`);
}

async function handlePerson(supabase: any, event: string, current: any, previous: any) {
  if (event === 'deleted') {
    await supabase.from('pipedrive_persons').delete().eq('pipedrive_id', previous?.id);
    return;
  }

  const p = current;
  if (!p?.id) return;

  // Extract primary phone and email
  const phone = Array.isArray(p.phone) ? p.phone[0]?.value : (p.phone || null);
  const email = Array.isArray(p.email) ? p.email[0]?.value : (p.email || null);

  // Try to match with wa_contact by phone
  let waContactId = null;
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: contact } = await supabase
      .from('wa_contacts')
      .select('id')
      .or(`phone.eq.${cleanPhone},phone.like.%${cleanPhone.slice(-9)}`)
      .limit(1)
      .single();

    if (contact) waContactId = contact.id;
  }

  await supabase.from('pipedrive_persons').upsert({
    pipedrive_id: p.id,
    name: p.name || '',
    email,
    phone,
    org_name: p.org_name || null,
    owner_name: p.owner_name || null,
    wa_contact_id: waContactId,
    raw_data: p,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'pipedrive_id' });

  console.log(`[pipedrive-webhook] Person upserted: ${p.name} (${p.id})`);
}

async function handleActivity(supabase: any, event: string, current: any, previous: any) {
  if (event === 'deleted') {
    await supabase.from('pipedrive_activities').delete().eq('pipedrive_id', previous?.id);
    return;
  }

  const a = current;
  if (!a?.id) return;

  await supabase.from('pipedrive_activities').upsert({
    pipedrive_id: a.id,
    type: a.type || 'call',
    subject: a.subject || '',
    deal_pipedrive_id: a.deal_id || null,
    person_pipedrive_id: a.person_id || null,
    done: a.done === true || a.done === 1,
    due_date: a.due_date || null,
    due_time: a.due_time || null,
    note: a.note || null,
    raw_data: a,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'pipedrive_id' });

  console.log(`[pipedrive-webhook] Activity upserted: ${a.subject} (${a.id})`);
}

async function handleNote(supabase: any, event: string, current: any, previous: any) {
  if (event === 'deleted') {
    await supabase.from('pipedrive_notes').delete().eq('pipedrive_id', previous?.id);
    return;
  }

  const n = current;
  if (!n?.id) return;

  await supabase.from('pipedrive_notes').upsert({
    pipedrive_id: n.id,
    content: n.content || '',
    deal_pipedrive_id: n.deal_id || null,
    person_pipedrive_id: n.person_id || null,
    raw_data: n,
  }, { onConflict: 'pipedrive_id' });

  console.log(`[pipedrive-webhook] Note upserted: (${n.id})`);
}
