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

  // Handle v2 format: person_id can be object {value: X} or plain number
  const personId = typeof d.person_id === 'object' ? d.person_id?.value : d.person_id;

  // Try to match with wa_conversation by person phone
  let waConversationId = null;
  let teamMemberId = null;
  let personName = d.person_name || d.title || null;

  // Extract phone from ALL possible locations (v1 and v2 Pipedrive formats)
  let dealPhone: string | null = null;

  // 1. Direct phone field on deal (v1)
  if (d.phone) {
    dealPhone = String(d.phone).replace(/\D/g, '');
  }

  // 2. custom_fields (v2 format — phone stored as {type:"phone", value:"..."})
  if (!dealPhone && d.custom_fields) {
    for (const key of Object.keys(d.custom_fields)) {
      const cf = d.custom_fields[key];
      if (cf && typeof cf === 'object' && cf.type === 'phone' && cf.value) {
        dealPhone = String(cf.value).replace(/\D/g, '');
        break;
      }
      // Also handle plain string values that look like phones
      if (cf && typeof cf === 'string' && cf.replace(/\D/g, '').length >= 10) {
        dealPhone = cf.replace(/\D/g, '');
        break;
      }
    }
  }

  // 3. person_phone (some Pipedrive setups embed it directly)
  if (!dealPhone && d.person_phone) {
    dealPhone = String(d.person_phone).replace(/\D/g, '');
  }

  console.log(`[pipedrive-webhook] Phone extraction: dealPhone=${dealPhone}, person_name=${personName}`);

  // V2: person_name might not exist, try to get from pipedrive_persons
  if (personId) {
    const { data: person } = await supabase
      .from('pipedrive_persons')
      .select('wa_contact_id, name, phone')
      .eq('pipedrive_id', personId)
      .single();

    if (person) {
      if (!personName) personName = person.name;

      // If person has no phone but deal has phone in custom_fields, update person
      if (!person.phone && dealPhone) {
        await supabase.from('pipedrive_persons')
          .update({ phone: dealPhone })
          .eq('pipedrive_id', personId);
        console.log(`[pipedrive-webhook] Updated person ${personId} phone from deal custom_fields: ${dealPhone}`);

        // Also try to match wa_contact now
        const cleanPhone = dealPhone;
        const { data: contact } = await supabase
          .from('wa_contacts')
          .select('id')
          .or(`phone.eq.${cleanPhone},phone.like.%${cleanPhone.slice(-9)}`)
          .limit(1)
          .single();

        if (contact) {
          await supabase.from('pipedrive_persons')
            .update({ wa_contact_id: contact.id })
            .eq('pipedrive_id', personId);
          
          const { data: conv } = await supabase
            .from('wa_conversations')
            .select('id, assigned_to')
            .eq('contact_id', contact.id)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .single();

          if (conv) {
            waConversationId = conv.id;
            teamMemberId = conv.assigned_to;
          }
        }
      } else if (person.wa_contact_id) {
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
  }

  // V2: owner_id can be number, try to match to team_member by owner email from meta or custom fields
  const ownerName = d.owner_name || null;

  // Handle org_id as object or number
  const orgId = typeof d.org_id === 'object' ? d.org_id?.value : d.org_id;
  const orgName = d.org_name || (typeof d.org_id === 'object' ? d.org_id?.name : null);

  const dealData = {
    pipedrive_id: d.id,
    title: d.title || '',
    person_name: personName,
    person_id: personId || null,
    org_name: orgName,
    stage_name: d.stage_order_nr != null ? `Stage ${d.stage_order_nr}` : (d.stage_name || null),
    pipeline_name: d.pipeline_id ? `Pipeline ${d.pipeline_id}` : null,
    status: d.status || 'open',
    value: d.value || 0,
    currency: d.currency || 'BRL',
    won_time: d.won_time || null,
    lost_time: d.lost_time || null,
    close_time: d.close_time || null,
    lost_reason: d.lost_reason || null,
    owner_name: ownerName,
    owner_email: d.cc_email || null,
    wa_conversation_id: waConversationId,
    team_member_id: teamMemberId,
    raw_data: d,
    updated_at: new Date().toISOString(),
  };

  await supabase.from('pipedrive_deals').upsert(dealData, { onConflict: 'pipedrive_id' });
  console.log(`[pipedrive-webhook] Deal upserted: ${d.title} (${d.id}) status=${d.status}`);

  // PROACTIVE SDR IA: On new deal, auto-create contact + conversation and trigger AI outreach
  // Trigger for ANY deal label that matches a configured lead_source in the AI SDR config
  const dealLabel = d.label;
  const dealLabelIds = d.label_ids || [];
  
  // Resolve all label IDs present on this deal
  const resolvedLabelIds: number[] = [];
  if (dealLabel != null && !isNaN(Number(dealLabel))) resolvedLabelIds.push(Number(dealLabel));
  if (Array.isArray(dealLabelIds)) {
    dealLabelIds.forEach((lid: any) => {
      const n = Number(lid);
      if (!isNaN(n) && !resolvedLabelIds.includes(n)) resolvedLabelIds.push(n);
    });
  }

  console.log(`[pipedrive-webhook] Label check: label=${dealLabel}, label_ids=${JSON.stringify(dealLabelIds)}, resolved=${JSON.stringify(resolvedLabelIds)}`);

  // Check if any resolved label matches a configured lead_source on any AI SDR instance
  let matchedLabelId: number | null = null;
  let matchedSourceContext = "";
  let matchedSourceName = "";

  // We'll check when we have the target instance (below)
  const hasAnyLabel = resolvedLabelIds.length > 0;

  if (!hasAnyLabel) {
    console.log(`[pipedrive-webhook] Skipping proactive: deal ${d.id} has no labels`);
  }

  if (event === 'create' && hasAnyLabel) {
    // DEDUP: Check if we already processed a "create" webhook for this same deal
    const { count: previousCreateCount } = await supabase
      .from('pipedrive_webhook_logs')
      .select('id', { count: 'exact', head: true })
      .eq('pipedrive_id', d.id)
      .eq('entity', 'deal')
      .eq('event', 'create')
      .eq('processed', true);

    if ((previousCreateCount || 0) > 0) {
      console.log(`[pipedrive-webhook] Skipping proactive: deal ${d.id} already processed`);
      return;
    }

    // Resolve phone from all sources
    let resolvedPhone = dealPhone || null;
    
    // Try person record if no dealPhone
    if (!resolvedPhone && personId) {
      const { data: personRec } = await supabase
        .from('pipedrive_persons')
        .select('phone')
        .eq('pipedrive_id', personId)
        .single();
      if (personRec?.phone) {
        resolvedPhone = personRec.phone.replace(/\D/g, '');
      }
    }

    if (!resolvedPhone) {
      console.log(`[pipedrive-webhook] No phone found for deal ${d.id}, skipping proactive`);
      return;
    }

    const cleanPhone = resolvedPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    console.log(`[pipedrive-webhook] Resolved phone: ${formattedPhone} for ${personName}`);

    // Determine which instance to use based on deal owner → closer mapping
    // Try to match deal owner to a team_member, then find their instance
    const ownerId = d.owner_id;
    let targetInstance: any = null;

    // Get all AI SDR enabled instances
    const { data: sdrInstances } = await supabase
      .from('wa_instances')
      .select('id, instance_name, is_connected, ai_sdr_enabled, ai_sdr_config, sdr_id, closer_id')
      .eq('ai_sdr_enabled', true)
      .eq('is_connected', true);

    if (!sdrInstances || sdrInstances.length === 0) {
      console.log('[pipedrive-webhook] No connected AI SDR instance found');
      return;
    }

    // If deal has an owner, try to match to a closer's instance
    if (ownerId) {
      // Check if any team member is mapped to this pipedrive owner
      // For now, use the instance whose closer matches the deal assignment
      // or fall back to any available instance
      for (const inst of sdrInstances) {
        if (inst.closer_id === teamMemberId && teamMemberId) {
          targetInstance = inst;
          break;
        }
      }
    }

    // Fallback: use first available instance
    if (!targetInstance) {
      targetInstance = sdrInstances[0];
    }

    console.log(`[pipedrive-webhook] Using instance: ${targetInstance.instance_name} (closer: ${targetInstance.closer_id})`);

    // Match deal label with configured lead_sources
    const instConfig = targetInstance.ai_sdr_config || {};
    const leadSources = instConfig.lead_sources || [];
    for (const labelId of resolvedLabelIds) {
      const matchedSource = leadSources.find((s: any) => s.active && Number(s.pipedrive_label_id) === labelId);
      if (matchedSource) {
        matchedLabelId = labelId;
        matchedSourceContext = matchedSource.context || "";
        matchedSourceName = matchedSource.name || "";
        break;
      }
    }

    if (!matchedLabelId) {
      console.log(`[pipedrive-webhook] Skipping proactive: no active lead_source matches labels ${JSON.stringify(resolvedLabelIds)}`);
      return;
    }

    console.log(`[pipedrive-webhook] Matched lead source: ${matchedSourceName} (label ${matchedLabelId})`);

    // Find or create wa_contact on this instance
    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from('wa_contacts')
      .select('id')
      .eq('instance_id', targetInstance.id)
      .or(`phone.eq.${formattedPhone},phone.like.%${cleanPhone.slice(-9)}`)
      .limit(1)
      .single();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from('wa_contacts')
        .insert({
          phone: formattedPhone,
          name: personName || d.title || 'Lead Pipedrive',
          instance_id: targetInstance.id,
        })
        .select('id')
        .single();
      contactId = newContact?.id || null;
      console.log(`[pipedrive-webhook] Created wa_contact on ${targetInstance.instance_name}: ${contactId}`);
    }

    if (!contactId) return;

    // Link pipedrive_persons to wa_contact
    if (personId) {
      await supabase.from('pipedrive_persons')
        .update({ wa_contact_id: contactId })
        .eq('pipedrive_id', personId);
    }

    // Find or create wa_conversation on this instance
    let conversationId: string | null = null;
    const { data: existingConv } = await supabase
      .from('wa_conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('instance_id', targetInstance.id)
      .limit(1)
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await supabase
        .from('wa_conversations')
        .insert({
          contact_id: contactId,
          instance_id: targetInstance.id,
          status: 'active',
          lead_status: 'novo',
          assigned_to: targetInstance.closer_id || targetInstance.sdr_id || null,
          assigned_role: targetInstance.closer_id ? 'closer' : 'sdr',
        })
        .select('id')
        .single();
      conversationId = newConv?.id || null;
      console.log(`[pipedrive-webhook] Created wa_conversation on ${targetInstance.instance_name}: ${conversationId}`);
    }

    if (!conversationId) return;

    // Update deal with wa_conversation link
    await supabase.from('pipedrive_deals')
      .update({ wa_conversation_id: conversationId, team_member_id: targetInstance.closer_id || targetInstance.sdr_id })
      .eq('pipedrive_id', d.id);

    // Trigger AI SDR proactive outreach
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    try {
      const sdrResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-sdr-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          instance_id: targetInstance.id,
          instance_name: targetInstance.instance_name,
          contact_phone: formattedPhone,
          contact_name: personName || d.title,
          trigger_type: 'proactive',
          pipedrive_context: {
            deal_title: d.title,
            deal_value: d.value,
            org_name: orgName,
            origin: d.origin || 'ManuallyCreated',
          },
        }),
      });

      const sdrResult = await sdrResp.json();
      console.log(`[pipedrive-webhook] AI SDR proactive result on ${targetInstance.instance_name}:`, JSON.stringify(sdrResult));
    } catch (sdrErr) {
      console.error(`[pipedrive-webhook] AI SDR trigger error:`, sdrErr);
    }
  }
}

async function handlePerson(supabase: any, event: string, current: any, previous: any) {
  if (event === 'deleted') {
    await supabase.from('pipedrive_persons').delete().eq('pipedrive_id', previous?.id);
    return;
  }

  const p = current;
  if (!p?.id) return;

  // Support ALL Pipedrive formats for phone and email extraction
  // v1: phone/email as array of {value, label, primary}
  // v2: phones/emails as array of {value, label, primary}
  // v2 alt: custom_fields with {type:"phone", value:"..."}
  // v2 alt2: direct string fields
  const phoneArr = p.phone || p.phones || [];
  const emailArr = p.email || p.emails || [];
  
  let phone: string | null = null;
  if (Array.isArray(phoneArr) && phoneArr.length > 0) {
    phone = phoneArr[0]?.value || null;
  } else if (typeof phoneArr === 'string') {
    phone = phoneArr;
  }

  let email: string | null = null;
  if (Array.isArray(emailArr) && emailArr.length > 0) {
    email = emailArr[0]?.value || null;
  } else if (typeof emailArr === 'string') {
    email = emailArr;
  }

  // Also check custom_fields for phone (v2 sometimes puts phone there)
  let resolvedPhone = phone;
  if (!resolvedPhone && p.custom_fields) {
    for (const key of Object.keys(p.custom_fields)) {
      const cf = p.custom_fields[key];
      if (cf && typeof cf === 'object' && cf.type === 'phone' && cf.value) {
        resolvedPhone = cf.value;
        break;
      }
      if (cf && typeof cf === 'string' && cf.replace(/\D/g, '').length >= 10) {
        resolvedPhone = cf;
        break;
      }
    }
  }
  // Direct person_phone field
  if (!resolvedPhone && p.person_phone) {
    resolvedPhone = p.person_phone;
  }

  // Try to match with wa_contact by phone
  let waContactId = null;
  if (resolvedPhone) {
    const cleanPhone = resolvedPhone.replace(/\D/g, '');
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
    name: p.name || p.first_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '',
    email,
    phone: resolvedPhone,
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
