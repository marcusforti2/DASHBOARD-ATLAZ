import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calculate the next business date/time adding N hours, respecting business hours (08-19h BRT, Mon-Fri).
 */
function getNextBusinessDateTime(from: Date, hoursToAdd: number): Date {
  // Work in BRT (UTC-3)
  const BRT_OFFSET = -3;
  const result = new Date(from.getTime() + hoursToAdd * 60 * 60 * 1000);
  
  // Get BRT hour
  const getBrtHour = (d: Date) => {
    const utcHour = d.getUTCHours();
    return (utcHour + BRT_OFFSET + 24) % 24;
  };
  
  const getBrtDay = (d: Date) => {
    const shifted = new Date(d.getTime() + BRT_OFFSET * 60 * 60 * 1000);
    return shifted.getUTCDay();
  };
  
  // If weekend, move to Monday 9am BRT
  let day = getBrtDay(result);
  while (day === 0 || day === 6) {
    result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
    day = getBrtDay(result);
  }
  
  // If before 8am BRT, set to 9am
  let brtHour = getBrtHour(result);
  if (brtHour < 8) {
    const diff = 9 - brtHour;
    result.setTime(result.getTime() + diff * 60 * 60 * 1000);
  }
  
  // If after 21h BRT, move to next business day 9am
  brtHour = getBrtHour(result);
  if (brtHour >= 21) {
    // Move to next day 9am BRT
    result.setTime(result.getTime() + (24 - brtHour + 9) * 60 * 60 * 1000);
    // Check if weekend again
    day = getBrtDay(result);
    while (day === 0 || day === 6) {
      result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
      day = getBrtDay(result);
    }
  }
  
  return result;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { conversation_id, instance_id, contact_phone: _contact_phone, instance_name, contact_name: _contact_name, incoming_message, trigger_type, pipedrive_context, force, incoming_is_audio } = body;
    let contact_phone = _contact_phone;
    let contact_name = _contact_name;
    const instName = instance_name || null; // will be resolved after instance fetch

    const isProactive = trigger_type === "proactive";

    if (!conversation_id || !instance_id) {
      return new Response(JSON.stringify({ error: "Missing conversation_id or instance_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance config
    const { data: instance } = await supabase
      .from("wa_instances")
      .select("ai_sdr_enabled, ai_sdr_config, instance_name, sdr_id, closer_id")
      .eq("id", instance_id)
      .single();

    if (!instance?.ai_sdr_enabled) {
      return new Response(JSON.stringify({ skipped: "AI SDR not enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config: any = instance.ai_sdr_config || {};

    // Check feature toggles
    const features = {
      auto_reply: config.feature_auto_reply !== false,
      auto_tag: config.feature_auto_tag !== false,
      qualification: config.feature_qualification !== false,
      handoff: config.feature_handoff !== false,
      sentiment: config.feature_sentiment === true,
      pipedrive_sync: config.feature_pipedrive_sync === true,
      rate_limit: config.feature_rate_limit !== false,
      reengagement: config.feature_reengagement === true,
      blacklist: config.feature_blacklist === true,
      daily_summary: config.feature_daily_summary === true,
      language_detection: config.feature_language_detection === true,
      linkedin_lookup: config.feature_linkedin_lookup === true,
      time_escalation: config.feature_time_escalation === true,
      tts_reply: config.feature_tts_reply === true,
    };

    if (!features.auto_reply && !isProactive) {
      return new Response(JSON.stringify({ skipped: "auto_reply disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== BUG FIX #1: STOP AI AFTER HANDOFF =====
    // If lead_status is "agendado" or "urgente", the closer took over — AI must NOT respond
    {
      const { data: convCheck } = await supabase
        .from("wa_conversations")
        .select("lead_status")
        .eq("id", conversation_id)
        .single();

      const blockedStatuses = ["agendado", "urgente"];
      if (convCheck?.lead_status && blockedStatuses.includes(convCheck.lead_status) && !isProactive && !force) {
        console.log(`[ai-sdr] Skipping: lead status is '${convCheck.lead_status}' — human takeover active`);
        return new Response(JSON.stringify({ skipped: `human_takeover_${convCheck.lead_status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== BUG FIX #5: HUMAN MODE — stop AI if a human closer responded recently =====
    {
      const humanWindow = config.human_takeover_minutes || 60; // default 60 min
      const { data: recentHumanMsg } = await supabase
        .from("wa_messages")
        .select("id, agent_name")
        .eq("conversation_id", conversation_id)
        .eq("sender", "agent")
        .neq("agent_name", "SDR IA 🤖")
        .gte("created_at", new Date(Date.now() - humanWindow * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (recentHumanMsg && !isProactive && !force) {
        console.log("[ai-sdr] Skipping: human agent responded recently (human takeover mode)", recentHumanMsg.agent_name);
        return new Response(JSON.stringify({ skipped: "human_takeover_active" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== BUG FIX #6: BUSINESS HOURS CHECK =====
    if (config.business_hours_only && !isProactive) {
      const BRT_OFFSET = -3;
      const now = new Date();
      const brtHour = (now.getUTCHours() + BRT_OFFSET + 24) % 24;
      const shifted = new Date(now.getTime() + BRT_OFFSET * 60 * 60 * 1000);
      const brtDay = shifted.getUTCDay();
      const startHour = config.business_hours_start ?? 8;
      const endHour = config.business_hours_end ?? 21;

      if (brtDay === 0 || brtDay === 6 || brtHour < startHour || brtHour >= endHour) {
        console.log(`[ai-sdr] Outside business hours (BRT ${brtHour}h, day ${brtDay}). Scheduling follow-up for next business morning.`);
        
        // Schedule a follow-up reminder for next business day at startHour
        try {
          const nextMorning = getNextBusinessDateTime(new Date(), 0);
          const getBrtHourFn = (d: Date) => (d.getUTCHours() - 3 + 24) % 24;
          const currentBrt = getBrtHourFn(nextMorning);
          if (currentBrt >= endHour || currentBrt < startHour || brtDay === 0 || brtDay === 6) {
            // Move to next business day at startHour+1 (9am)
            const tomorrow = new Date(nextMorning.getTime() + 24 * 60 * 60 * 1000);
            const tBrtDay = new Date(tomorrow.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
            let target = tomorrow;
            while (true) {
              const d = new Date(target.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
              if (d >= 1 && d <= 5) break;
              target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
            }
            // Set to startHour+1 BRT (e.g. 9am) = startHour+1+3 UTC
            const remindAtUtc = new Date(target);
            remindAtUtc.setUTCHours(startHour + 1 + 3, 0, 0, 0);
            
            // Create a follow-up reminder so the AI calls back
            if (conversation_id) {
              // Fetch contact_id for this conversation
              const { data: convData } = await supabase
                .from("wa_conversations")
                .select("contact_id")
                .eq("id", conversation_id)
                .single();
              
              const { data: existingReminder } = await supabase
                .from("wa_follow_up_reminders")
                .select("id")
                .eq("conversation_id", conversation_id)
                .eq("completed", false)
                .limit(1);
              
              if (!existingReminder || existingReminder.length === 0) {
                const creatorId = instance?.sdr_id || instance?.closer_id;
                if (creatorId && convData?.contact_id) {
                  await supabase.from("wa_follow_up_reminders").insert({
                    conversation_id: conversation_id,
                    contact_id: convData.contact_id,
                    remind_at: remindAtUtc.toISOString(),
                    note: "[AUTO] Mensagem recebida fora do horário comercial - responder pela manhã",
                    created_by: creatorId,
                  });
                  console.log("[ai-sdr] Off-hours follow-up scheduled for", remindAtUtc.toISOString());
                }
              }
            }
          }
        } catch (e) {
          console.error("[ai-sdr] Failed to schedule off-hours follow-up:", e);
        }
        
        return new Response(JSON.stringify({ skipped: "outside_business_hours", queued_followup: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // BLACKLIST CHECK
    if (features.blacklist && contact_phone) {
      const blacklist: string[] = config.blacklist_numbers || [];
      const normalizedPhone = contact_phone.replace(/\D/g, "");
      const isBlocked = blacklist.some(n => normalizedPhone.endsWith(n.replace(/\D/g, "")));
      if (isBlocked) {
        console.log("[ai-sdr] Phone is blacklisted:", contact_phone);
        return new Response(JSON.stringify({ skipped: "blacklisted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // RATE LIMIT CHECK
    const exemptConversations: string[] = config.rate_limit_exempt_conversations || [];
    const isExempt = exemptConversations.includes(conversation_id);
    if (features.rate_limit && !isProactive && !force && !isExempt) {
      const rateLimitPerHour = config.rate_limit_per_hour || 5;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("wa_messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversation_id)
        .eq("sender", "agent")
        .eq("agent_name", "SDR IA 🤖")
        .gte("created_at", oneHourAgo);
      
      if ((recentCount || 0) >= rateLimitPerHour) {
        console.log(`[ai-sdr] Rate limit reached: ${recentCount}/${rateLimitPerHour} msgs/hour for conversation ${conversation_id}`);
        return new Response(JSON.stringify({ skipped: "rate_limited" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // CONCURRENCY GUARD — also acts as distributed lock
    const guardWindow = isProactive ? 5 * 60 * 1000 : 15 * 1000;
    const { data: recentAgentMsg } = await supabase
      .from("wa_messages")
      .select("id, created_at")
      .eq("conversation_id", conversation_id)
      .eq("sender", "agent")
      .gte("created_at", new Date(Date.now() - guardWindow).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentAgentMsg) {
      console.log(`[ai-sdr] Skipping: recent agent message found (${isProactive ? 'proactive' : 'concurrency'} guard)`, recentAgentMsg.id);
      return new Response(JSON.stringify({ skipped: isProactive ? "proactive_guard" : "concurrency_guard" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // INSERT PROCESSING LOCK — prevents duplicate AI calls from parallel webhooks
    // Insert a placeholder message immediately so any concurrent call will see it in the guard above
    const lockText = "__ai_processing__";
    const { data: lockMsg, error: lockErr } = await supabase
      .from("wa_messages")
      .insert({
        conversation_id,
        instance_id,
        sender: "agent",
        agent_name: "SDR IA 🤖",
        text: lockText,
      })
      .select("id")
      .single();

    if (lockErr) {
      console.error("[ai-sdr] Failed to insert processing lock:", lockErr);
      return new Response(JSON.stringify({ error: "lock_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lockId = lockMsg.id;
    console.log("[ai-sdr] Processing lock acquired:", lockId);

    // Get conversation history
    const { data: messages } = await supabase
      .from("wa_messages")
      .select("sender, text, created_at, agent_name")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const history = (messages || []).reverse();

    // Get conversation details
    const { data: conversation } = await supabase
      .from("wa_conversations")
      .select("lead_status, contact_id")
      .eq("id", conversation_id)
      .single();

    // Resolve contact_phone and contact_name if not provided in body
    if ((!contact_phone || !contact_name) && conversation?.contact_id) {
      const { data: contactData } = await supabase
        .from("wa_contacts")
        .select("phone, name")
        .eq("id", conversation.contact_id)
        .single();
      if (contactData) {
        contact_phone = contact_phone || contactData.phone;
        contact_name = contact_name || contactData.name;
      }
    }
    console.log("[ai-sdr] Resolved contact:", contact_name, contact_phone);
    if (features.handoff) {
      const agentMsgCount = history.filter(m => m.sender === "agent" && m.agent_name === "SDR IA 🤖").length;
      const maxBeforeHandoff = config.max_messages_before_handoff || 10;
      if (agentMsgCount >= maxBeforeHandoff) {
        console.log("[ai-sdr] Handoff threshold reached");
        await supabase.from("wa_conversations").update({ lead_status: "qualificado" }).eq("id", conversation_id);
        return new Response(JSON.stringify({ skipped: "handoff_threshold", handoff: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get tags
    const { data: tags } = await supabase.from("wa_tags").select("id, name, is_stage, sort_order").order("sort_order");
    const { data: currentTags } = await supabase
      .from("wa_contact_tags")
      .select("tag_id, wa_tags(name)")
      .eq("contact_id", conversation?.contact_id || "");

    // Get closer name
    let closerName = "";
    if (instance.closer_id) {
      const { data: closerMember } = await supabase
        .from("team_members")
        .select("name")
        .eq("id", instance.closer_id)
        .single();
      closerName = closerMember?.name || "";
    }

    // Get ALL knowledge
    const { data: knowledge } = await supabase
      .from("company_knowledge")
      .select("title, content, category")
      .eq("active", true)
      .limit(10);

    const generalKnowledge = (knowledge || []).filter(k => k.category !== "ai_prompt")
      .map(k => `[${k.title}]: ${k.content.substring(0, 500)}`).join("\n\n");

    const aiPrompts = (knowledge || []).filter(k => k.category === "ai_prompt")
      .map(k => `[${k.title}]: ${k.content}`).join("\n\n");

    // Build conversation history text
    const agentLabel = closerName || "SDR IA";
    const conversationText = history
      .map(m => `${m.sender === "contact" ? contact_name || "Lead" : agentLabel}: ${m.text}`)
      .join("\n");

    const currentTagNames = (currentTags || []).map((ct: any) => ct.wa_tags?.name).filter(Boolean);
    const availableTagNames = (tags || []).map(t => `${t.name}${t.is_stage ? " (estágio)" : ""}`);

    // Get closer's calendar availability
    let calendarContext = "";
    if (features.qualification && instance.closer_id) {
      try {
        const { data: closerProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("team_member_id", instance.closer_id)
          .single();

        if (closerProfile) {
          const { data: calToken } = await supabase
            .from("google_calendar_tokens")
            .select("access_token, refresh_token, token_expires_at")
            .eq("user_id", closerProfile.id)
            .single();

          if (calToken) {
            let accessToken = calToken.access_token;
            const expiresAt = new Date(calToken.token_expires_at);
            if (expiresAt < new Date()) {
              const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
              const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
              if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
                const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    refresh_token: calToken.refresh_token,
                    grant_type: "refresh_token",
                  }),
                });
                if (refreshResp.ok) {
                  const tokens = await refreshResp.json();
                  accessToken = tokens.access_token;
                  await supabase.from("google_calendar_tokens").update({
                    access_token: accessToken,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                  }).eq("user_id", closerProfile.id);
                }
              }
            }

            const now = new Date();
            const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
            const nowBrt = new Date(now.getTime() + BRT_OFFSET_MS);
            const timeMin = now.toISOString();
            const timeMax = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

            const calResp = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (calResp.ok) {
              const calData = await calResp.json();
              const events = (calData.items || [])
                .filter((e: any) => e.status !== "cancelled" && e.start?.dateTime)
                .map((e: any) => ({
                  start: new Date(e.start.dateTime),
                  end: new Date(e.end.dateTime),
                }));

              // Calculate FREE slots for today and next 2 days
              const WORK_START = 9; // 9h BRT
              const WORK_END = 18; // 18h BRT
              const SLOT_DURATION_MIN = 30; // 30-min slots
              const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

              const getFreeSlots = (targetDate: Date): string[] => {
                const year = targetDate.getUTCFullYear();
                const month = targetDate.getUTCMonth();
                const day = targetDate.getUTCDate();
                const dayOfWeek = targetDate.getUTCDay();
                
                // Skip weekends
                if (dayOfWeek === 0 || dayOfWeek === 6) return [];

                const slots: string[] = [];
                
                for (let h = WORK_START; h < WORK_END; h++) {
                  for (let m = 0; m < 60; m += SLOT_DURATION_MIN) {
                    // Create slot time in BRT → UTC
                    const slotStartUtc = new Date(Date.UTC(year, month, day, h + 3, m)); // BRT+3 = UTC
                    const slotEndUtc = new Date(slotStartUtc.getTime() + SLOT_DURATION_MIN * 60 * 1000);
                    
                    // Skip past slots
                    if (slotStartUtc.getTime() < now.getTime() + 30 * 60 * 1000) continue; // at least 30min from now

                    // Check conflict with any event
                    const hasConflict = events.some((ev: any) => 
                      slotStartUtc < ev.end && slotEndUtc > ev.start
                    );
                    
                    if (!hasConflict) {
                      const hStr = String(h).padStart(2, "0");
                      const mStr = String(m).padStart(2, "0");
                      slots.push(`${hStr}:${mStr}`);
                    }
                  }
                }
                return slots;
              };

              // Today in BRT
              const todayBrt = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate()));
              const tomorrowBrt = new Date(todayBrt.getTime() + 24 * 60 * 60 * 1000);
              const dayAfterBrt = new Date(todayBrt.getTime() + 2 * 24 * 60 * 60 * 1000);

              const todaySlots = getFreeSlots(todayBrt);
              const tomorrowSlots = getFreeSlots(tomorrowBrt);
              const dayAfterSlots = getFreeSlots(dayAfterBrt);

              const todayName = dayNames[todayBrt.getUTCDay()];
              const tomorrowName = dayNames[tomorrowBrt.getUTCDay()];
              const dayAfterName = dayNames[dayAfterBrt.getUTCDay()];

              const formatDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

              let agendaText = `\n\nAGENDA DO CLOSER — HORÁRIOS LIVRES (use para propor ligação):\n`;
              
              if (todaySlots.length > 0) {
                agendaText += `\n📅 HOJE (${todayName} ${formatDate(todayBrt)}) — PRIORIDADE MÁXIMA:\n${todaySlots.slice(0, 6).join(", ")}\n`;
              } else {
                agendaText += `\n📅 HOJE (${todayName} ${formatDate(todayBrt)}): Sem horários disponíveis\n`;
              }
              
              if (tomorrowSlots.length > 0) {
                agendaText += `\n📅 AMANHÃ (${tomorrowName} ${formatDate(tomorrowBrt)}):\n${tomorrowSlots.slice(0, 6).join(", ")}\n`;
              }
              
              if (dayAfterSlots.length > 0 && tomorrowSlots.length === 0) {
                agendaText += `\n📅 ${dayAfterName} (${formatDate(dayAfterBrt)}):\n${dayAfterSlots.slice(0, 6).join(", ")}\n`;
              }

              agendaText += `\nREGRAS DE AGENDAMENTO:
1. PRIORIZE O HORÁRIO MAIS RÁPIDO POSSÍVEL — idealmente HOJE
2. Ofereça o horário mais próximo de HOJE como opção principal
3. Ofereça também UMA opção de amanhã como alternativa
4. Exemplo: "Consigo te ligar hoje às 14:30, topa? Se preferir, amanhã às 10:00 também tenho disponível."
5. NÃO ofereça horários que NÃO estão na lista acima
6. Se não houver horário hoje, ofereça o mais cedo de amanhã
7. Quando o lead confirmar, retorne "meeting_confirmed": true e "meeting_datetime" no formato ISO (YYYY-MM-DDTHH:mm:00-03:00)`;

              calendarContext = agendaText;
            }
          }
        }
      } catch (calErr) {
        console.error("[ai-sdr] Calendar error:", calErr);
      }
    }

    // Get Pipedrive deal context + LinkedIn enrichment
    let pipedriveContext = "";
    let linkedinContext = "";
    if (features.pipedrive_sync && conversation?.contact_id) {
      try {
        const { data: pipeContact } = await supabase
          .from("pipedrive_persons")
          .select("pipedrive_id, name, org_name, raw_data")
          .eq("wa_contact_id", conversation.contact_id)
          .single();

        if (pipeContact) {
          const { data: deals } = await supabase
            .from("pipedrive_deals")
            .select("title, value, stage_name, status, currency")
            .eq("person_id", pipeContact.pipedrive_id)
            .limit(3);

          if (deals?.length) {
            pipedriveContext = `\n\nDADOS DO PIPEDRIVE:\nContato: ${pipeContact.name} (${pipeContact.org_name || "sem empresa"})\nDeals:\n${deals.map(d => `- ${d.title}: ${d.status} | ${d.stage_name} | ${d.currency} ${d.value}`).join("\n")}`;
          }

          // LinkedIn scraping via Piloterr
          const PILOTERR_API_KEY = Deno.env.get("PILOTERR_API_KEY");
          if (PILOTERR_API_KEY) {
            try {
              // Try to extract LinkedIn URL from Pipedrive raw_data
              const rawData: any = pipeContact.raw_data || {};
              let linkedinUrl = "";
              
              // Pipedrive stores social profiles in various fields
              if (typeof rawData === 'object') {
                // Check common fields for LinkedIn URL
                const jsonStr = JSON.stringify(rawData).toLowerCase();
                const linkedinMatch = jsonStr.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
                if (linkedinMatch) {
                  linkedinUrl = linkedinMatch[0];
                }
              }

              if (linkedinUrl) {
                console.log("[ai-sdr] LinkedIn URL found in Pipedrive:", linkedinUrl);
                const scraperResp = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-scraper`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ linkedin_url: linkedinUrl }),
                });

                if (scraperResp.ok) {
                  const scraperData = await scraperResp.json();
                  if (scraperData.found && scraperData.profile) {
                    const p = scraperData.profile;
                    linkedinContext = `\n\nPERFIL LINKEDIN DO LEAD (use para personalizar a abordagem):
- Nome: ${p.full_name}
- Cargo: ${p.company_role || p.headline}
- Empresa: ${p.company}
- Setor: ${p.industry || "N/A"}
- Localização: ${p.location || "N/A"}
- Resumo: ${p.summary ? p.summary.substring(0, 300) : "N/A"}
${p.experience?.length ? `- Experiência recente:\n${p.experience.map((e: any) => `  • ${e.title} @ ${e.company} (${e.duration})`).join("\n")}` : ""}
${p.education?.length ? `- Formação: ${p.education.map((e: any) => `${e.degree} - ${e.school}`).join(", ")}` : ""}

IMPORTANTE: Use essas informações para criar rapport GENUÍNO. Mencione algo específico do perfil dele (cargo, empresa, setor) para mostrar que você pesquisou. NÃO seja genérico.`;
                    console.log("[ai-sdr] LinkedIn enrichment success:", p.full_name, p.company);
                  }
                }
              } else {
                // Try searching by name + company
                const searchQuery = `${pipeContact.name} ${pipeContact.org_name || ""}`.trim();
                if (searchQuery.length > 3) {
                  console.log("[ai-sdr] Searching LinkedIn by name:", searchQuery);
                  const scraperResp = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-scraper`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ query: searchQuery }),
                  });

                  if (scraperResp.ok) {
                    const scraperData = await scraperResp.json();
                    if (scraperData.found && scraperData.profile) {
                      const p = scraperData.profile;
                      linkedinContext = `\n\nPERFIL LINKEDIN ENCONTRADO (possível match - use com cuidado):
- Nome: ${p.full_name}
- Cargo: ${p.company_role || p.headline}
- Empresa: ${p.company}
- Setor: ${p.industry || "N/A"}
- Localização: ${p.location || "N/A"}

Use essas informações para personalizar a abordagem, mas NÃO mencione diretamente que buscou no LinkedIn.`;
                      console.log("[ai-sdr] LinkedIn search match:", p.full_name);
                    }
                  }
                }
              }
            } catch (linkedinErr) {
              console.error("[ai-sdr] LinkedIn scraping error (non-blocking):", linkedinErr);
            }
          }
        }
      } catch (pipeErr) {
        console.error("[ai-sdr] Pipedrive context error:", pipeErr);
      }
    }

    const qualificationQuestions = config.qualification_questions || [
      "Como posso te chamar?",
      "Qual tipo de negócio você atua?",
      "Qual o faturamento mensal aproximado?",
      "Já tem processo comercial estruturado?",
    ];
    const scoreThresholds = config.score_thresholds || { a_min: 80, b_min: 50 };
    const followUpHours = config.follow_up_hours || 24;

    // ===== ORGANIC CONTACT DETECTION =====
    // A contact is "organic" when: not a proactive trigger + no Pipedrive deal + no source tags
    const sourceTagNames = ["linkedin", "dripify", "indicação", "indicacao", "prospecção", "prospeccao"];
    const hasSourceTag = currentTagNames.some((t: string) =>
      sourceTagNames.some(s => t.toLowerCase().includes(s))
    );
    const hasPipedriveDeal = pipedriveContext.length > 0;
    const isOrganicContact = !isProactive && !hasSourceTag && !hasPipedriveDeal;
    const organicModeEnabled = config.organic_mode_enabled !== false; // default ON

    if (isOrganicContact && organicModeEnabled) {
      console.log("[ai-sdr] Organic contact detected — switching to receptive assistant mode");
    }

    // Build the master system prompt
    const masterPrompt = config.master_prompt || "";
    const identityLine = closerName
      ? `Você é ${closerName}, especialista comercial. O lead DEVE acreditar que está falando diretamente com ${closerName}. Use primeira pessoa. NUNCA mencione que é IA, assistente virtual ou bot.`
      : `Você é uma SDR (Sales Development Representative) virtual de IA integrada ao WhatsApp.`;

    // ===== SMART RANDOMIZER — Forces unique message variations =====
    const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const greetingStyles = [
      "Comece com 'E aí' ou 'Fala'",
      "Comece com 'Opa' ou 'Olá'",
      "Comece direto com o nome da pessoa sem saudação",
      "Comece com uma observação ou elogio específico",
      "Comece com uma pergunta direta e curiosa",
      "Comece com 'Bom dia/tarde' de forma profissional",
      "Comece mencionando algo em comum ou referência",
    ];
    const toneVariations = [
      "Tom: levemente descontraído com humor sutil",
      "Tom: profissional e direto ao ponto",
      "Tom: curioso e investigativo, fazendo perguntas",
      "Tom: empático e consultivo, focando na dor do lead",
      "Tom: confiante e provocativo, desafiando o status quo",
      "Tom: amigável e caloroso, como um colega de confiança",
    ];
    const structureVariations = [
      "Use 2 mensagens curtas separadas por |||",
      "Use 3 mensagens bem curtas separadas por |||",
      "Use 1 mensagem um pouco maior (3-4 linhas) + 1 pergunta curta separada por |||",
      "Use 4 mensagens ultra-curtas (1 linha cada) separadas por |||",
    ];
    const emojiStyles = [
      "Use 1 emoji no máximo",
      "Use 2-3 emojis estratégicos",
      "Não use emoji nenhum — seja seco e profissional",
      "Use emojis apenas na última mensagem",
    ];
    const closingStyles = [
      "Termine com uma pergunta aberta curta",
      "Termine com uma provocação/curiosidade",
      "Termine com uma proposta direta de ação",
      "Termine com um CTA suave tipo 'faz sentido?'",
      "Termine com 'O que acha?' ou 'Topa?'",
    ];

    const randomSeed = `
VARIAÇÃO OBRIGATÓRIA PARA ESTA MENSAGEM (siga à risca para não repetir padrões):
- Saudação: ${pickRandom(greetingStyles)}
- ${pickRandom(toneVariations)}
- Estrutura: ${pickRandom(structureVariations)}
- Emoji: ${pickRandom(emojiStyles)}
- Fechamento: ${pickRandom(closingStyles)}
- Seed de criatividade: ${Math.random().toString(36).substring(2, 8)}

REGRA ANTI-REPETIÇÃO: Analise as mensagens anteriores que VOCÊ já enviou nesta conversa. NÃO repita:
- A mesma estrutura de frase
- As mesmas palavras de abertura
- O mesmo tipo de pergunta
- Os mesmos emojis
- A mesma forma de se referir ao lead
Se você já usou "Fala [nome]!" antes, use algo completamente diferente agora.
`;

    // ===== BUILD SYSTEM PROMPT — branch between SDR mode and Organic/Receptive mode =====
    let systemPrompt: string;

    if (isOrganicContact && organicModeEnabled) {
      // ===== ORGANIC / RECEPTIVE ASSISTANT MODE =====
      const organicPrompt = config.organic_prompt || "";
      const organicName = config.organic_name || closerName || "";
      const organicIdentity = organicName
        ? `Você é ${organicName}. O contato DEVE acreditar que está falando com ${organicName} — uma pessoa REAL. Use primeira pessoa. NUNCA mencione que é IA, bot ou assistente virtual.`
        : `Você é um assistente receptivo da empresa, integrado ao WhatsApp. NUNCA revele que é IA.`;

      systemPrompt = `${masterPrompt ? `REGRAS ABSOLUTAS DO GESTOR (prioridade máxima):\n${masterPrompt}\n\n` : ""}${organicIdentity}
${randomSeed}

MODO: ASSISTENTE RECEPTIVO (contato orgânico — sem origem CRM/prospecção)
Este contato veio organicamente (pelo celular, sem ser de prospecção ativa). NÃO trate como um lead de prospecção.

${organicPrompt ? `INSTRUÇÕES ESPECÍFICAS DO GESTOR PARA CONTATOS ORGÂNICOS:\n${organicPrompt}\n` : ""}

CONHECIMENTO DO NEGÓCIO:
${aiPrompts || ""}

${generalKnowledge ? `INFORMAÇÕES DA EMPRESA:\n${generalKnowledge}` : ""}

${config.prompt_context ? `CONTEXTO ADICIONAL:\n${config.prompt_context}` : ""}

SEU COMPORTAMENTO COMO ASSISTENTE RECEPTIVO:
1. RESPONDA dúvidas sobre a empresa, produtos e serviços de forma clara e prestativa
2. NÃO tente qualificar, pontuar ou empurrar o contato para uma ligação agressivamente
3. Seja cordial, informativo e útil — como um bom atendimento ao cliente
4. Se o contato demonstrar interesse genuíno em comprar/contratar, ENTÃO ofereça marcar uma conversa com ${closerName || "um especialista"}
5. Se a pergunta for fora do seu escopo, diga que vai verificar com a equipe e retorne
6. Se pedirem para falar com um humano, faça handoff imediato
7. NÃO pressione, NÃO use gatilhos de vendas, NÃO faça follow-up agressivo
8. Seja natural e humano — pareça alguém respondendo no celular
9. Use abreviações naturais do WhatsApp quando o tom for casual (hj, tb, msg, vc, blz, qdo, pq, etc.)
10. QUEBRE mensagens como uma pessoa real faz — várias msgs curtas, não textão

REGRAS CRÍTICAS — LIMITES DE ATUAÇÃO:
- NUNCA assuma compromissos pelo responsável (nada de "vou passar aí", "vou resolver", "vou conferir com o financeiro")
- NUNCA invente rotinas ou atividades pessoais ("tava resolvendo umas coisas", "vou me organizar")
- NUNCA puxe conversa desnecessária ("e aí como tá a correria?", "tá conseguindo dar conta?")
- Você é ASSISTENTE — anota o que a pessoa precisa, diz que vai repassar pro responsável e ENCERRA
- Máximo 2-3 trocas de mensagem. Depois de entender o assunto → encerra educadamente
- Se a pessoa insistir em conversar, seja breve e redirecione: "vou anotar e o [nome] te retorna, blz? 😊"

REGRA DE PRIMEIRA RESPOSTA:
- Na PRIMEIRA interação, já se apresente de forma CURTA e natural
- Exemplos: "oi! aqui é a ${organicName || "Bia"}, assistente do ${closerName || "time"} 😊 como posso te ajudar?" 
- Ou: "oii td bem? sou a ${organicName || "Bia"}, to aqui dando suporte pro ${closerName || "time"} hj"
- NÃO mande textão, mas já se identifique logo — uma ou duas msgs curtas
- Depois que a pessoa disser o que precisa → anota, diz que repassa e encerra

TOM: ${config.organic_tone || config.tone || "cordial e prestativo"}
${calendarContext}

ETIQUETAS DISPONÍVEIS: ${availableTagNames.join(", ")}
ETIQUETAS ATUAIS: ${currentTagNames.length > 0 ? currentTagNames.join(", ") : "Nenhuma"}
STATUS ATUAL: ${conversation?.lead_status || "novo"}

REGRAS DE FORMATO:
1. QUEBRE respostas em mensagens curtas separadas por "|||"
2. Cada parte: NO MÁXIMO 2 linhas
3. Use entre 2 e 4 mensagens separadas por "|||"
4. NUNCA invente informações sobre produtos/serviços que não estão no contexto
5. Use formatação WhatsApp: *negrito*, _itálico_
6. Use emojis com moderação
7. NUNCA revele que é uma IA
8. Se o contato estiver irritado ou pedir humano → handoff imediato

IMPORTANTE SOBRE MENSAGENS:
- Trate TODAS as mensagens recentes como UMA ÚNICA — responda uma vez só

Responda EXATAMENTE neste formato JSON:
{
  "reply": "Resposta|||Segunda parte (opcional)",
  "new_lead_status": null,
  "add_tags": ["nome_da_tag"],
  "remove_tags": [],
  "should_handoff": false,
  "handoff_reason": "",
  "schedule_follow_up": false,
  "activity_note": "Resumo curto da interação",
  "is_organic": true${features.sentiment ? ',\n  "sentiment": "positivo" | "neutro" | "negativo"' : ""}
}`;
    } else {
      // ===== STANDARD SDR MODE =====
      systemPrompt = `${masterPrompt ? `REGRAS ABSOLUTAS DO GESTOR (prioridade máxima):\n${masterPrompt}\n\n` : ""}${identityLine}
${randomSeed}

CONHECIMENTO DO NEGÓCIO:
${aiPrompts || ""}

${generalKnowledge ? `INFORMAÇÕES DA EMPRESA:\n${generalKnowledge}` : ""}

${config.prompt_context ? `INSTRUÇÕES ADICIONAIS:\n${config.prompt_context}` : ""}

${config.target_audience ? `PÚBLICO-ALVO (ICP):\n${config.target_audience}` : ""}

${config.pain_points ? `DORES VISCERAIS DO PÚBLICO (use para gerar rapport e quebrar objeções):\n${config.pain_points}` : ""}

${config.desires ? `DESEJOS PROFUNDOS DO PÚBLICO (use para criar urgência e motivação):\n${config.desires}` : ""}

SEU OBJETIVO PRINCIPAL:
- QUALIFICAR RÁPIDO e CHAMAR PARA UMA LIGAÇÃO/REUNIÃO com ${closerName || "o especialista"}
- NÃO ENROLE: Máximo 3-4 trocas de mensagens antes de propor a ligação
- A ligação é COM VOCÊ (${closerName || "o especialista"}) — deixe claro que VOCÊ vai ligar pessoalmente
- Se o lead mostrar qualquer interesse, PROPONHA A LIGAÇÃO imediatamente
- Faça no máximo 1-2 perguntas de qualificação rápidas e já proponha o call

FLUXO IDEAL (siga esta ordem):
1. Primeira troca: Conectar e gerar rapport (1 mensagem)
2. Segunda troca: Entender a situação do lead com 1-2 perguntas diretas
3. Terceira troca: PROPOR A LIGAÇÃO — "Que tal a gente bater um papo rápido de 15 min? EU te ligo."
4. Se aceitar: Confirmar horário e marcar na agenda
5. Se recusar: QUEBRAR OBJEÇÃO (veja abaixo)

ESTRATÉGIA DE QUEBRA DE OBJEÇÃO:
- "Não tenho tempo" → "Entendo! São só 15 minutinhos. Posso te ligar amanhã às [horário]? Se não for pra você, a gente encerra rápido."
- "Manda por aqui" → "Claro, posso adiantar algumas coisas aqui. Mas o que eu quero te mostrar é mais visual/prático — 15 min no call vale mais que 50 mensagens 😄"
- "Não estou interessado" → "Sem problemas! Antes de encerrar, posso te fazer uma última pergunta? [pergunta que gera curiosidade sobre resultado]"
- "Tá caro / não tenho budget" → "Entendo! Por isso a ligação — quero entender seu cenário antes de qualquer coisa. Às vezes a solução é diferente do que você imagina."
- Se o lead recusar 2x a ligação: Respeitar, deixar porta aberta e agendar follow-up

FOLLOW-UP AUTOMÁTICO:
- Se o lead parar de responder, retorne "schedule_follow_up": true no JSON
- O sistema vai automaticamente enviar um follow-up após ${followUpHours}h
- Na mensagem de follow-up, seja leve: "Fala [Nome]! Sumiu 😄 Conseguiu pensar sobre o que conversamos?"

QUANDO O LEAD CONFIRMAR HORÁRIO/DATA DA LIGAÇÃO:
- Retorne "meeting_confirmed": true e "meeting_datetime": "data e hora confirmada no formato ISO com -03:00"
- Finalize a conversa de forma positiva: "Perfeito! Anotado aqui. Te ligo [dia] às [hora]! 🤝"
- NÃO continue a conversa após confirmar. Apenas encerre.
- O sistema vai agendar follow-ups automáticos de 6h e 1h antes da ligação.

ESTRATÉGIA DE AGENDAMENTO (IMPORTANTE):
- Quando propor a ligação, CONSULTE A AGENDA acima e ofereça o horário mais RÁPIDO possível (hoje, se houver)
- Sempre ofereça 2 opções: a mais rápida (hoje) + uma alternativa (amanhã)
- Se o lead disser "pode ser agora" ou "pode ser hoje", ofereça o slot mais próximo da agenda
- Exemplo ideal: "Tenho um horário hoje às 15:30, topa? Se preferir, amanhã às 10:00 também consigo."
- NUNCA invente horários — use SOMENTE os horários livres listados na agenda

QUANDO O LEAD PEDIR PARA LIGAR AGORA / NA HORA:
- Se o lead disser "pode ligar agora", "estou disponível agora", "liga agora", "vamos conversar agora":
  - Retorne "urgent_call": true no JSON
  - Responda: "Show! Deixa eu verificar aqui rapidão e já te ligo, ok? 🔥"
  - O sistema vai alertar o closer para ligar IMEDIATAMENTE
  - PARE DE RESPONDER após isso — um humano vai assumir

PERGUNTAS DE QUALIFICAÇÃO (faça de forma natural e RÁPIDA, NÃO como formulário):
${qualificationQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

CLASSIFICAÇÃO (baseada em se aceitou ligação):
- Lead A (score >= ${scoreThresholds.a_min}): Aceitou ligação — agendar reunião direto
- Lead B (score >= ${scoreThresholds.b_min}): Mostrou interesse mas não confirmou — insistir com elegância
- Lead C (score < ${scoreThresholds.b_min}): Não qualificado — encerrar educadamente

TOM: ${config.tone || "profissional"}
${calendarContext}
${pipedriveContext}
${linkedinContext}

ETIQUETAS DISPONÍVEIS: ${availableTagNames.join(", ")}
ETIQUETAS ATUAIS: ${currentTagNames.length > 0 ? currentTagNames.join(", ") : "Nenhuma"}
STATUS ATUAL: ${conversation?.lead_status || "novo"}

REGRAS DE FORMATO (MUITO IMPORTANTE):
1. QUEBRE suas respostas em MENSAGENS CURTAS separadas por "|||"
2. Cada parte deve ter NO MÁXIMO 2 linhas
3. Pareça humano: uma pessoa real no WhatsApp manda várias mensagens curtas, não um textão
4. Exemplo: "Fala João! 😊|||Vi seu perfil e curti demais sua trajetória|||Te chamei aqui pra trocar uma ideia rápida sobre algo que pode fazer sentido pra você|||Posso te fazer uma pergunta?"
5. Use entre 2 e 4 mensagens separadas por "|||"
6. NUNCA invente informações sobre produtos/serviços que não estão no contexto
7. Use formatação WhatsApp: *negrito*, _itálico_
8. Use emojis com moderação
9. Se o lead perguntar algo fora do escopo, diga que vai verificar com a equipe
10. NUNCA revele que é uma IA
11. Se o lead estiver irritado ou pedir para falar com humano, faça handoff imediato
12. FOCO EM LIGAR: Cada mensagem deve levar o lead mais perto de aceitar uma ligação

IMPORTANTE SOBRE MENSAGENS DO LEAD:
- O lead pode enviar várias mensagens seguidas quebrando em linhas
- Trate TODAS as mensagens recentes como UMA ÚNICA mensagem — responda uma vez só
- NÃO responda cada mensagem separadamente

${features.sentiment ? "ANÁLISE DE SENTIMENTO: Analise o sentimento do lead (positivo, neutro, negativo, urgente) e inclua no JSON." : ""}

${features.language_detection ? `DETECÇÃO DE IDIOMA: Identifique automaticamente o idioma do lead (português, inglês, espanhol, etc.) e RESPONDA NO MESMO IDIOMA. Se o lead escrever em inglês, responda em inglês. Se espanhol, responda em espanhol. Inclua "detected_language" no JSON.` : ""}

${features.linkedin_lookup ? `PESQUISA LINKEDIN: Se o lead mencionar empresa, cargo ou nome completo, inclua "linkedin_lookup": true e "linkedin_query": "nome ou empresa" no JSON para enriquecimento automático.` : ""}

MOVIMENTAÇÃO DE PIPELINE (IMPORTANTE):
- Cada mudança de status do lead DEVE mover o deal no CRM automaticamente
- O sistema faz isso baseado no "new_lead_status" que você retornar
- PIPELINE: 0-Entrada → 1-Agendar Ligação → 2-Ligação Agendada → 3-Reunião
- "novo" e "em_contato" = Estágio 0 (Entrada) — NÃO move o deal, ele já está aqui
- "qualificado" = Estágio 1 (Agendar Ligação) — lead mostrou interesse, hora de propor call
- "agendado" = Estágio 2 (Ligação Agendada) — lead CONFIRMOU horário da ligação
- "reuniao" = Estágio 3 (Reunião) — ligação/reunião acontecendo ou realizada
- "perdido" = Deal marcado como LOST
- Na primeira interação proativa, use "em_contato" (mantém no estágio 0)
- SEMPRE retorne "new_lead_status" quando o status mudar

ATIVIDADES NO CRM:
- Após CADA interação, o sistema cria automaticamente uma atividade "feita" com resumo
- Também cria um follow-up de 24h (horário comercial) como "não feita"
- Inclua "activity_note" com um resumo curto da interação (1-2 frases)

Responda EXATAMENTE neste formato JSON:
{
  "reply": "Primeira parte|||Segunda parte|||Terceira parte",
  "new_lead_status": "novo" | "em_contato" | "qualificado" | "agendado" | "reuniao" | "perdido" | null,
  "lead_score": "A" | "B" | "C" | null,
  "lead_score_value": 0-100,
  "lead_score_reason": "Motivo do score",
  "qualification_data": {
    "name": "",
    "business_type": "",
    "revenue": "",
    "pain": "",
    "decision_maker": true/false
  },
  "add_tags": ["nome_da_tag"],
  "remove_tags": ["nome_da_tag"],
  "should_handoff": false,
  "handoff_reason": "",
  "handoff_type": "closer" | "sdr" | null,
  "schedule_meeting": false,
  "meeting_suggestion": "",
  "meeting_confirmed": false,
  "meeting_datetime": "",
  "urgent_call": false,
  "schedule_follow_up": false,
  "follow_up_message": "",
  "activity_note": "Resumo curto da interação"${features.sentiment ? ',\n  "sentiment": "positivo" | "neutro" | "negativo" | "urgente"' : ""}${features.language_detection ? ',\n  "detected_language": "pt" | "en" | "es" | "other"' : ""}${features.linkedin_lookup ? ',\n  "linkedin_lookup": false,\n  "linkedin_query": ""' : ""}
}`;
    }
    let userMessage: string;
    if (isProactive) {
      const pCtx = pipedrive_context || {};
      const linkedinUrl = pCtx.linkedin_url || "";
      const sourceContext = pCtx.lead_source_context || "";
      const sourceName = pCtx.lead_source_name || "PROSPECÇÃO";

      // If no specific context from lead_source config, try matching from instance config
      let finalSourceContext = sourceContext;
      if (!finalSourceContext && pCtx.label_id) {
        const leadSources = config.lead_sources || [];
        const matched = leadSources.find((s: any) => s.active && Number(s.pipedrive_label_id) === Number(pCtx.label_id));
        if (matched) finalSourceContext = matched.context || "";
      }

      // Enrich with LinkedIn data via Piloterr for proactive triggers
      let proactiveLinkedinContext = linkedinContext; // may already be set from pipedrive_persons
      if (!proactiveLinkedinContext && linkedinUrl) {
        const PILOTERR_API_KEY = Deno.env.get("PILOTERR_API_KEY");
        if (PILOTERR_API_KEY) {
          try {
            console.log("[ai-sdr] Proactive: scraping LinkedIn URL:", linkedinUrl);
            const scraperResp = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-scraper`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ linkedin_url: linkedinUrl }),
            });
            if (scraperResp.ok) {
              const scraperData = await scraperResp.json();
              if (scraperData.found && scraperData.profile) {
                const p = scraperData.profile;
                proactiveLinkedinContext = `\n\nPERFIL LINKEDIN DO LEAD (use para personalizar a primeira mensagem):
- Nome: ${p.full_name}
- Cargo: ${p.company_role || p.headline}
- Empresa: ${p.company}
- Setor: ${p.industry || "N/A"}
- Localização: ${p.location || "N/A"}
- Resumo: ${p.summary ? p.summary.substring(0, 300) : "N/A"}
${p.experience?.length ? `- Experiência recente:\n${p.experience.map((e: any) => `  • ${e.title} @ ${e.company} (${e.duration})`).join("\n")}` : ""}

IMPORTANTE: Mencione algo ESPECÍFICO do perfil (cargo, empresa, setor) para criar rapport genuíno na primeira mensagem.`;
                console.log("[ai-sdr] Proactive LinkedIn enrichment:", p.full_name, p.company);
              }
            }
          } catch (liErr) {
            console.error("[ai-sdr] Proactive LinkedIn scrape error (non-blocking):", liErr);
          }
        }
      }

      userMessage = `Este é um NOVO LEAD que acabou de ser cadastrado no CRM (Pipedrive). Você deve iniciar a conversa proativamente pelo WhatsApp.

ORIGEM DO LEAD: ${sourceName}

CONTEXTO DO LEAD:
- Nome: ${contact_name || "Não informado"}
- Telefone: ${contact_phone}
- Deal: ${pCtx.deal_title || "N/A"}
- Valor: ${pCtx.deal_value || 0}
- Origem: ${pCtx.origin || "Manual"}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ""}
${proactiveLinkedinContext || ""}

${finalSourceContext ? `INSTRUÇÕES ESPECÍFICAS PARA ESTA ORIGEM (siga à risca):\n${finalSourceContext}\n` : ""}
INSTRUÇÕES GERAIS PARA PRIMEIRA MENSAGEM:
1. Adapte a abordagem ao contexto da origem (${sourceName}) — cada origem tem um tom diferente
2. Seja natural e pessoal — use o primeiro nome do lead
3. NÃO faça pitch direto — gere curiosidade e abra a conversa
4. Termine com uma pergunta aberta para engajar o lead
5. Mantenha a mensagem curta (máximo 4 linhas)
6. Varie o estilo: às vezes mais direto, às vezes mais descontraído — não use sempre o mesmo template
${proactiveLinkedinContext ? "7. USE os dados do LinkedIn para criar uma abordagem PERSONALIZADA e DIFERENCIADA" : ""}

LEMBRE: Use o separador "|||" para quebrar em mensagens curtas.`;
    } else {
      userMessage = `HISTÓRICO DA CONVERSA:\n${conversationText}\n\nÚLTIMA(S) MENSAGEM(NS) DO LEAD (podem ser várias mensagens seguidas — responda como UMA SÓ resposta):\n${incoming_message}`;
    }

    // AI call with retry + failover
    const aiModels = [
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash",
      "openai/gpt-5-mini",
    ];

    let reply = "";
    let parsed: any = {};

    for (const model of aiModels) {
      try {
        console.log(`[ai-sdr] Trying model: ${model}`);
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.85 + Math.random() * 0.15, // 0.85-1.0 for natural variation
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[ai-sdr] Model ${model} error: ${aiResponse.status}`, errText);
          if (aiResponse.status === 429 || aiResponse.status === 402) continue;
          if (aiResponse.status >= 400 && aiResponse.status < 500) {
            throw new Error(`Client error ${aiResponse.status}`);
          }
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        if (!content.trim()) {
          console.warn(`[ai-sdr] Model ${model} returned empty content, trying next`);
          continue;
        }

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON");
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = { reply: content.replace(/```json|```/g, "").trim() };
        }

        reply = parsed.reply || "";
        if (reply) {
          console.log(`[ai-sdr] Success with model: ${model}`);
          break;
        }
        console.warn(`[ai-sdr] Model ${model} parsed but empty reply, trying next`);
      } catch (modelErr) {
        console.error(`[ai-sdr] Model ${model} failed:`, modelErr);
        continue;
      }
    }

    if (!reply) {
      // Remove the lock message since we have nothing to send
      await supabase.from("wa_messages").delete().eq("id", lockId);
      console.log("[ai-sdr] Lock released (no reply):", lockId);
      return new Response(JSON.stringify({ error: "All AI models failed or returned empty reply" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split reply into multiple messages using "|||" separator
    const replyParts = reply.split("|||").map(p => p.trim()).filter(p => p.length > 0);
    console.log(`[ai-sdr] Reply split into ${replyParts.length} parts`);

    // Send each part with human-like random delays + presence simulation
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY && features.auto_reply) {
      const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
      const fullReply: string[] = [];
      const resolvedInstName = instName || instance.instance_name;

      // Helper: simulate human presence (read + typing)
      const simulatePresence = async (phone: string, textLength: number) => {
        try {
          // Mark as "read" first
          await fetch(`${baseUrl}/chat/markChatUnread/${resolvedInstName}`, {
            method: "PUT",
            headers: { apikey: EVOLUTION_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ remoteJid: `${phone}@s.whatsapp.net`, lastMessage: { key: { fromMe: false } }, chat: "read" }),
          }).catch(() => {});

          // Small pause after reading (0.5-1.5s)
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 500));

          // Send "composing" (typing indicator)
          await fetch(`${baseUrl}/chat/updatePresence/${resolvedInstName}`, {
            method: "POST",
            headers: { apikey: EVOLUTION_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ remoteJid: `${phone}@s.whatsapp.net`, presence: "composing" }),
          }).catch(() => {});

          // Typing duration proportional to message length (30-80ms per char, min 2s, max 8s)
          const typingMs = Math.min(8000, Math.max(2000, textLength * (Math.floor(Math.random() * 50) + 30)));
          console.log(`[ai-sdr] Simulating typing for ${typingMs}ms (${textLength} chars)`);
          await new Promise(r => setTimeout(r, typingMs));

          // Stop typing
          await fetch(`${baseUrl}/chat/updatePresence/${resolvedInstName}`, {
            method: "POST",
            headers: { apikey: EVOLUTION_API_KEY!, "Content-Type": "application/json" },
            body: JSON.stringify({ remoteJid: `${phone}@s.whatsapp.net`, presence: "paused" }),
          }).catch(() => {});
        } catch (e) {
          console.warn("[ai-sdr] Presence simulation error:", e);
        }
      };

      // ===== SMART DELAY: Initial "reading + thinking" pause before any response =====
      const smartDelayEnabled = config.feature_smart_delay !== false;
      const isFirstMessage = isProactive;
      
      if (smartDelayEnabled && !isFirstMessage) {
        const incomingLength = (incoming_message || "").length;
        const minDelaySec = config.smart_delay_min_seconds || 3;
        const maxDelaySec = config.smart_delay_max_seconds || 20;
        const minMs = minDelaySec * 1000;
        const maxMs = maxDelaySec * 1000;
        
        // Scale delay based on message length within configured range
        const lengthFactor = Math.min(1, incomingLength / 150); // 0-1 based on msg length
        const baseDelay = minMs + (maxMs - minMs) * lengthFactor;
        // Add random variance (±30%)
        const variance = baseDelay * 0.3;
        const totalDelay = Math.floor(baseDelay - variance + Math.random() * variance * 2);
        const clampedDelay = Math.max(minMs, Math.min(maxMs, totalDelay));
        
        console.log(`[ai-sdr] Smart delay: waiting ${clampedDelay}ms (range: ${minDelaySec}-${maxDelaySec}s, msg: ${incomingLength} chars)`);
        await new Promise(r => setTimeout(r, clampedDelay));
      }

      for (let i = 0; i < replyParts.length; i++) {
        const part = replyParts[i];

        // Simulate human reading + typing before each message
        await simulatePresence(contact_phone, part.length);

        // Additional random gap between messages (1-3s)
        if (i > 0) {
          const gap = Math.floor(Math.random() * 2000) + 1000;
          await new Promise(resolve => setTimeout(resolve, gap));
        }

        const sendResp = await fetch(`${baseUrl}/message/sendText/${resolvedInstName}`, {
          method: "POST",
          headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ number: contact_phone, text: part }),
        });

        if (!sendResp.ok) {
          console.error("[ai-sdr] Send error part", i + 1, ":", sendResp.status, await sendResp.text());
        } else {
          console.log("[ai-sdr] Message part", i + 1, "sent to", contact_phone);
        }

        fullReply.push(part);
      }

      // Update the lock message to the first part, insert remaining parts
      if (fullReply.length > 0) {
        await supabase.from("wa_messages").update({ text: fullReply[0] }).eq("id", lockId);
        for (let j = 1; j < fullReply.length; j++) {
          await supabase.from("wa_messages").insert({
            conversation_id, instance_id, sender: "agent",
            agent_name: "SDR IA 🤖", text: fullReply[j],
          });
        }
      } else {
        // No reply sent, remove lock
        await supabase.from("wa_messages").delete().eq("id", lockId);
      }

      // Update conversation with last message
      const lastPart = fullReply[fullReply.length - 1] || reply;
      await supabase.from("wa_conversations").update({
        last_message: lastPart,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      }).eq("id", conversation_id);

      // TTS: Send audio version of the reply if enabled and incoming was audio
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      const shouldSendAudio = features.tts_reply && ELEVENLABS_API_KEY && incoming_is_audio;
      
      if (shouldSendAudio) {
        try {
          // Combine all parts into one text for TTS
          const ttsText = fullReply.join(". ").replace(/\|\|\|/g, ". ").substring(0, 2000);
          const voiceId = config.tts_voice_id || "onwK4e9ZLuTAKqWW03F9"; // Daniel (default)
          
          console.log("[ai-sdr] Generating TTS audio with ElevenLabs...");
          
          const ttsResp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32`,
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: ttsText,
                model_id: "eleven_turbo_v2_5",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  speed: 1.05,
                },
              }),
            }
          );

          if (ttsResp.ok) {
            // Upload audio to storage
            const audioBuffer = await ttsResp.arrayBuffer();
            const audioBytes = new Uint8Array(audioBuffer);
            const audioFileName = `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;

            const { error: uploadErr } = await supabase.storage
              .from("wa-media")
              .upload(audioFileName, audioBytes, { contentType: "audio/mpeg", upsert: false });

            if (!uploadErr) {
              const audioPublicUrl = `${SUPABASE_URL}/storage/v1/object/public/wa-media/${audioFileName}`;

              // Small delay to feel natural
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1500) + 1000));

              // Send audio via Evolution API
              await fetch(`${baseUrl}/message/sendWhatsAppAudio/${resolvedInstName}`, {
                method: "POST",
                headers: { apikey: EVOLUTION_API_KEY!, "Content-Type": "application/json" },
                body: JSON.stringify({ number: contact_phone, audio: audioPublicUrl }),
              });

              // Save audio message to DB
              await supabase.from("wa_messages").insert({
                conversation_id, instance_id, sender: "agent",
                agent_name: "SDR IA 🤖", text: "🎵 Áudio",
                media_type: "audio", media_url: audioPublicUrl,
                media_mime_type: "audio/mpeg",
              });

              console.log("[ai-sdr] TTS audio sent to", contact_phone);
            } else {
              console.error("[ai-sdr] TTS upload error:", uploadErr);
            }
          } else {
            console.error("[ai-sdr] TTS generation error:", ttsResp.status, await ttsResp.text());
          }
        } catch (ttsErr) {
          console.error("[ai-sdr] TTS error (non-blocking):", ttsErr);
        }
      }
    }

    // 2. Auto-update lead status
    if (parsed.new_lead_status && conversation) {
      await supabase.from("wa_conversations").update({
        lead_status: parsed.new_lead_status,
      }).eq("id", conversation_id);
      console.log("[ai-sdr] Lead status →", parsed.new_lead_status);
    }

    // 3. Auto-update tags
    if (features.auto_tag && conversation?.contact_id && tags) {
      const tagMap = new Map(tags.map(t => [t.name.toLowerCase(), t.id]));

      if (parsed.add_tags?.length) {
        for (const tagName of parsed.add_tags) {
          const tagId = tagMap.get(tagName.toLowerCase());
          if (tagId) {
            await supabase.from("wa_contact_tags")
              .upsert({ contact_id: conversation.contact_id, tag_id: tagId }, { onConflict: "contact_id,tag_id" })
              .select();
            console.log("[ai-sdr] Tag added:", tagName);
          }
        }
      }
      if (parsed.remove_tags?.length) {
        for (const tagName of parsed.remove_tags) {
          const tagId = tagMap.get(tagName.toLowerCase());
          if (tagId) {
            await supabase.from("wa_contact_tags").delete()
              .eq("contact_id", conversation.contact_id).eq("tag_id", tagId);
          }
        }
      }
    }

    // 4. Lead scoring + handoff logic
    if (parsed.lead_score && conversation?.contact_id) {
      await supabase.from("wa_lead_scores").upsert({
        contact_id: conversation.contact_id,
        score: parsed.lead_score_value || 0,
        sentiment_score: parsed.sentiment === "positivo" ? 80 : parsed.sentiment === "negativo" ? 20 : 50,
        engagement_score: Math.min(history.length * 10, 100),
        risk_level: parsed.lead_score === "C" ? "high" : parsed.lead_score === "B" ? "medium" : "low",
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: "contact_id" });
      console.log("[ai-sdr] Lead score:", parsed.lead_score, parsed.lead_score_value);
    }

    // 5. Handle handoff
    if (features.handoff && parsed.should_handoff) {
      const handoffType = parsed.handoff_type || "closer";
      const newStatus = handoffType === "closer" ? "qualificado" : "em_contato";

      await supabase.from("wa_conversations").update({ lead_status: newStatus }).eq("id", conversation_id);

      const responsibleId = handoffType === "closer" ? instance.closer_id : instance.sdr_id;
      if (responsibleId) {
        await supabase.from("proactive_alerts").insert({
          member_id: responsibleId,
          title: handoffType === "closer"
            ? "🔥 Lead Score A — Reunião pronta"
            : "🤖 Handoff: Lead precisa SDR humano",
          message: `A SDR IA transferiu o lead ${contact_name || contact_phone}.\nScore: ${parsed.lead_score || "—"} (${parsed.lead_score_value || 0}/100)\nMotivo: ${parsed.handoff_reason || "Lead qualificado."}\n${parsed.meeting_suggestion ? `Sugestão de horário: ${parsed.meeting_suggestion}` : ""}`,
          severity: handoffType === "closer" ? "high" : "medium",
          alert_type: "ai_handoff",
          data: {
            conversation_id,
            contact_phone,
            lead_score: parsed.lead_score,
            qualification_data: parsed.qualification_data,
            handoff_type: handoffType,
          },
        });
      }
      console.log("[ai-sdr] Handoff →", handoffType, "for", contact_phone);
    }

    // 6. URGENT CALL: Lead wants to talk NOW
    if (parsed.urgent_call) {
      console.log("[ai-sdr] 🚨 URGENT CALL requested by lead", contact_phone);

      // Alert the closer AND sdr
      const alertTargets = [instance.closer_id, instance.sdr_id].filter(Boolean);
      for (const memberId of alertTargets) {
        await supabase.from("proactive_alerts").insert({
          member_id: memberId!,
          title: "🚨 URGENTE: Lead quer ligar AGORA!",
          message: `O lead ${contact_name || contact_phone} pediu para falar AGORA pelo telefone!\n\n📞 Ligue imediatamente: ${contact_phone}\n\nA IA parou de responder. O lead está esperando a ligação.`,
          severity: "high",
          alert_type: "urgent_call",
          data: {
            conversation_id,
            contact_phone,
            contact_name: contact_name || "",
            urgent: true,
          },
        });
      }

      // Send WhatsApp alert to closer's phone
      if (EVOLUTION_API_URL && EVOLUTION_API_KEY && instance.closer_id) {
        const { data: closerMember } = await supabase
          .from("team_members")
          .select("phone")
          .eq("id", instance.closer_id)
          .single();

        if (closerMember?.phone) {
          const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
          const alertMsg = `🚨 *URGENTE — Lead quer ligar AGORA!*\n\n👤 ${contact_name || "Lead"}\n📞 ${contact_phone}\n\nO lead pediu pra ligar na hora. Ligue AGORA! A IA parou de responder.`;
          await fetch(`${baseUrl}/message/sendText/${instName}`, {
            method: "POST",
            headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ number: closerMember.phone, text: alertMsg }),
          });
          console.log("[ai-sdr] Urgent alert sent to closer phone:", closerMember.phone);
        }
      }

      // Mark conversation for human takeover (urgent_call uses its own status)
      await supabase.from("wa_conversations").update({
        lead_status: "urgente",
        assigned_to: instance.closer_id,
        assigned_role: "closer",
      }).eq("id", conversation_id);

      // AI won't respond because lead_status changed from normal flow
    }

    // 7. Meeting confirmed: schedule 6h and 1h follow-ups
    if (parsed.meeting_confirmed && conversation?.contact_id) {
      console.log("[ai-sdr] Meeting confirmed:", parsed.meeting_datetime);

      // Try to parse the meeting datetime — FORCE BRT (UTC-3)
      let meetingTime: Date | null = null;
      if (parsed.meeting_datetime) {
        try {
          let dtStr = String(parsed.meeting_datetime).trim();
          // If the AI returned a datetime WITHOUT timezone info, append BRT offset
          // e.g. "2026-03-11T14:00:00" → "2026-03-11T14:00:00-03:00"
          if (dtStr.length >= 16 && !dtStr.includes('+') && !dtStr.includes('Z') && !/\-\d{2}:\d{2}$/.test(dtStr)) {
            dtStr += '-03:00'; // America/Sao_Paulo = UTC-3
          }
          meetingTime = new Date(dtStr);
          if (isNaN(meetingTime.getTime())) meetingTime = null;
        } catch { meetingTime = null; }
      }

      if (meetingTime && meetingTime.getTime() > Date.now()) {
        // Schedule 6h before follow-up
        const sixHBefore = new Date(meetingTime.getTime() - 6 * 60 * 60 * 1000);
        if (sixHBefore.getTime() > Date.now()) {
          await supabase.from("wa_follow_up_reminders").insert({
            contact_id: conversation.contact_id,
            conversation_id,
            remind_at: sixHBefore.toISOString(),
            note: `Fala ${contact_name || ""}! 😊 Passando pra confirmar nosso papo de hoje. Tudo certo pro horário combinado?`,
            created_by: instance.sdr_id || instance.closer_id!,
          });
          console.log("[ai-sdr] 6h follow-up scheduled for", sixHBefore.toISOString());
        }

        // Schedule 1h before follow-up
        const oneHBefore = new Date(meetingTime.getTime() - 1 * 60 * 60 * 1000);
        if (oneHBefore.getTime() > Date.now()) {
          await supabase.from("wa_follow_up_reminders").insert({
            contact_id: conversation.contact_id,
            conversation_id,
            remind_at: oneHBefore.toISOString(),
            note: `Opa ${contact_name || ""}! Daqui a 1 hora temos nosso bate-papo 🔥 Te ligo no horário combinado, beleza?`,
            created_by: instance.sdr_id || instance.closer_id!,
          });
          console.log("[ai-sdr] 1h follow-up scheduled for", oneHBefore.toISOString());
        }
        // === CREATE GOOGLE CALENDAR EVENT FOR CLOSER ===
        if (instance.closer_id && (config.feature_calendar_auto !== false)) {
          try {
            const { data: closerProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("team_member_id", instance.closer_id)
              .single();

            if (closerProfile) {
              const { data: calToken } = await supabase
                .from("google_calendar_tokens")
                .select("access_token, refresh_token, token_expires_at")
                .eq("user_id", closerProfile.id)
                .single();

              if (calToken) {
                let accessToken = calToken.access_token;
                const expiresAt = new Date(calToken.token_expires_at);
                if (expiresAt < new Date()) {
                  const GCI = Deno.env.get("GOOGLE_CLIENT_ID");
                  const GCS = Deno.env.get("GOOGLE_CLIENT_SECRET");
                  if (GCI && GCS) {
                    const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: new URLSearchParams({ client_id: GCI, client_secret: GCS, refresh_token: calToken.refresh_token, grant_type: "refresh_token" }),
                    });
                    if (refreshResp.ok) {
                      const tokens = await refreshResp.json();
                      accessToken = tokens.access_token;
                      await supabase.from("google_calendar_tokens").update({
                        access_token: accessToken,
                        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                      }).eq("user_id", closerProfile.id);
                    }
                  }
                }

                const meetingEnd = new Date(meetingTime.getTime() + 30 * 60 * 1000); // 30 min duration
                const event = {
                  summary: `📞 Ligação — ${contact_name || "Lead"}`,
                  description: `Lead agendado pela SDR IA.\n\nNome: ${contact_name || "N/A"}\nTelefone: ${contact_phone || "N/A"}\n\nConversa: ${conversation_id}`,
                  start: { dateTime: meetingTime.toISOString(), timeZone: "America/Sao_Paulo" },
                  end: { dateTime: meetingEnd.toISOString(), timeZone: "America/Sao_Paulo" },
                  reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }, { method: "popup", minutes: 5 }] },
                  conferenceData: { createRequest: { requestId: `sdr-${conversation_id.slice(0, 8)}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
                };

                const calCreateResp = await fetch(
                  "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
                  {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify(event),
                  }
                );

                if (calCreateResp.ok) {
                  const createdEvent = await calCreateResp.json();
                  const meetLink = createdEvent.hangoutLink || "";
                  console.log("[ai-sdr] Google Calendar event created:", createdEvent.id, meetLink);

                  // Send WhatsApp notification to closer
                  if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
                    const { data: closerMember } = await supabase
                      .from("team_members")
                      .select("phone, name")
                      .eq("id", instance.closer_id)
                      .single();

                    if (closerMember?.phone) {
                      const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
                      const resolvedInstName = instName || instance.instance_name;
                      const dateStr = meetingTime.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
                      const timeStr = meetingTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
                      const alertMsg = `📅 *Novo agendamento confirmado!*\n\n👤 ${contact_name || "Lead"}\n📞 ${contact_phone}\n🗓 ${dateStr} às ${timeStr}\n${meetLink ? `🔗 Meet: ${meetLink}\n` : ""}\n✅ Evento criado na sua agenda automaticamente.\n\n_Agendado pela SDR IA 🤖_`;
                      
                      await fetch(`${baseUrl}/message/sendText/${resolvedInstName}`, {
                        method: "POST",
                        headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
                        body: JSON.stringify({ number: closerMember.phone, text: alertMsg }),
                      }).catch(e => console.error("[ai-sdr] Failed to notify closer via WhatsApp:", e));
                      console.log("[ai-sdr] Closer notified via WhatsApp:", closerMember.name);
                    }
                  }
                } else {
                  const calErr = await calCreateResp.text();
                  console.error("[ai-sdr] Failed to create calendar event:", calCreateResp.status, calErr);
                }
              } else {
                console.log("[ai-sdr] Closer has no Google Calendar connected, skipping event creation");
              }
            }
          } catch (calEventErr) {
            console.error("[ai-sdr] Calendar event creation error:", calEventErr);
          }
        }
      }

      // Update lead status to agendado
      await supabase.from("wa_conversations").update({
        lead_status: "agendado",
      }).eq("id", conversation_id);
    }

    // 8. Pipedrive sync: move deal, create activities
    if (features.pipedrive_sync && PIPEDRIVE_API_TOKEN && conversation?.contact_id) {
      try {
        const PIPE_BASE = "https://api.pipedrive.com/v1";

        // Find linked Pipedrive person
        const { data: existingPerson } = await supabase
          .from("pipedrive_persons")
          .select("pipedrive_id, name")
          .eq("wa_contact_id", conversation.contact_id)
          .single();

        if (existingPerson?.pipedrive_id) {
          // Find open deal for this person
          const { data: deals } = await supabase
            .from("pipedrive_deals")
            .select("pipedrive_id, title, stage_name, pipeline_name")
            .eq("person_id", existingPerson.pipedrive_id)
            .eq("status", "open")
            .limit(1);

          const deal = deals?.[0];

          if (deal) {
            // --- A) MOVE DEAL TO CORRECT STAGE ---
            if (parsed.new_lead_status) {
              // Fetch pipeline stages from Pipedrive to get real stage IDs
              const stagesResp = await fetch(`${PIPE_BASE}/stages?api_token=${PIPEDRIVE_API_TOKEN}`);
              const stagesData = await stagesResp.json();
              const allStages = stagesData.data || [];

              // Sort stages by order_nr and filter by deal's pipeline
              // Map lead status to stage order (0-indexed)
              // Pipeline: 0-Entrada/Oportunidade, 1-Agendar Ligação, 2-Ligação Agendada, 3-Reunião
              const statusToOrder: Record<string, number> = {
                "novo": 0,        // Entrada/Oportunidade — deal já chega aqui
                "em_contato": 0,  // Mantém no estágio 0 (primeiro contato feito, aguardando resposta)
                "qualificado": 1, // Agendar Ligação — lead qualificado, pronto pra propor call
                "agendado": 2,    // Ligação Agendada — lead confirmou horário
                "reuniao": 3,     // Reunião — call/reunião em andamento ou realizada
              };

              const targetOrder = statusToOrder[parsed.new_lead_status];

              if (targetOrder !== undefined) {
                // ===== BUG FIX #4: Filter stages by the deal's pipeline =====
                // First, get the deal's current pipeline_id from raw_data or by fetching
                const dealDetailResp = await fetch(`${PIPE_BASE}/deals/${deal.pipedrive_id}?api_token=${PIPEDRIVE_API_TOKEN}`);
                const dealDetail = await dealDetailResp.json();
                const dealPipelineId = dealDetail.data?.pipeline_id;

                const pipelineStages = allStages
                  .filter((s: any) => !dealPipelineId || s.pipeline_id === dealPipelineId)
                  .sort((a: any, b: any) => a.order_nr - b.order_nr);

                const targetStage = pipelineStages[targetOrder];

                if (targetStage) {
                  const moveResp = await fetch(`${PIPE_BASE}/deals/${deal.pipedrive_id}?api_token=${PIPEDRIVE_API_TOKEN}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stage_id: targetStage.id }),
                  });
                  const moveResult = await moveResp.json();
                  console.log(`[ai-sdr] Pipedrive deal ${deal.pipedrive_id} moved to stage ${targetStage.name} (order ${targetOrder}):`, moveResult.success);

                  // Update local deal record
                  await supabase.from("pipedrive_deals").update({
                    stage_name: targetStage.name,
                  }).eq("pipedrive_id", deal.pipedrive_id);
                }
              } else if (parsed.new_lead_status === "perdido") {
                // Mark deal as lost
                await fetch(`${PIPE_BASE}/deals/${deal.pipedrive_id}?api_token=${PIPEDRIVE_API_TOKEN}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "lost", lost_reason: parsed.lead_score_reason || "Lead não qualificado" }),
                });
                console.log(`[ai-sdr] Pipedrive deal ${deal.pipedrive_id} marked as LOST`);

                await supabase.from("pipedrive_deals").update({
                  status: "lost",
                  lost_reason: parsed.lead_score_reason || "Lead não qualificado",
                  lost_time: new Date().toISOString(),
                }).eq("pipedrive_id", deal.pipedrive_id);
              }
            }

            // --- B) CREATE ACTIVITY "DONE" (current interaction) ---
            const activityNote = parsed.activity_note || `Interação via WhatsApp com ${contact_name || contact_phone}`;
            const today = new Date();
            const dueDate = today.toISOString().split("T")[0];
            const dueTime = today.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

            const createActivityResp = await fetch(`${PIPE_BASE}/activities?api_token=${PIPEDRIVE_API_TOKEN}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subject: `✅ Contato WhatsApp — ${contact_name || contact_phone}`,
                type: "call",
                deal_id: deal.pipedrive_id,
                person_id: existingPerson.pipedrive_id,
                due_date: dueDate,
                due_time: dueTime,
                done: 1,
                note: `🤖 SDR IA\n\n${activityNote}\n\nScore: ${parsed.lead_score || "—"} (${parsed.lead_score_value || 0}/100)\nStatus: ${parsed.new_lead_status || conversation.lead_status}`,
              }),
            });
            const actResult = await createActivityResp.json();
            console.log(`[ai-sdr] Pipedrive activity DONE created:`, actResult.success);

            // Save to local DB
            if (actResult.data?.id) {
              await supabase.from("pipedrive_activities").upsert({
                pipedrive_id: actResult.data.id,
                type: "call",
                subject: `✅ Contato WhatsApp — ${contact_name || contact_phone}`,
                deal_pipedrive_id: deal.pipedrive_id,
                person_pipedrive_id: existingPerson.pipedrive_id,
                done: true,
                due_date: dueDate,
                due_time: dueTime,
                note: activityNote,
                raw_data: actResult.data,
              }, { onConflict: "pipedrive_id" });
            }

            // --- C) CREATE FOLLOW-UP ACTIVITY 24h (business hours, NOT done) ---
            const nextBusinessDay = getNextBusinessDateTime(new Date(), 24);
            const followUpDate = nextBusinessDay.toISOString().split("T")[0];
            const followUpTime = nextBusinessDay.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

            const followUpResp = await fetch(`${PIPE_BASE}/activities?api_token=${PIPEDRIVE_API_TOKEN}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subject: `⏰ Follow-up — ${contact_name || contact_phone}`,
                type: "call",
                deal_id: deal.pipedrive_id,
                person_id: existingPerson.pipedrive_id,
                due_date: followUpDate,
                due_time: followUpTime,
                done: 0,
                note: `🤖 Follow-up automático criado pela SDR IA.\n\nÚltima interação: ${activityNote}\nScore: ${parsed.lead_score || "—"}`,
              }),
            });
            const followResult = await followUpResp.json();
            console.log(`[ai-sdr] Pipedrive follow-up activity created for ${followUpDate} ${followUpTime}:`, followResult.success);

            // Save follow-up to local DB
            if (followResult.data?.id) {
              await supabase.from("pipedrive_activities").upsert({
                pipedrive_id: followResult.data.id,
                type: "call",
                subject: `⏰ Follow-up — ${contact_name || contact_phone}`,
                deal_pipedrive_id: deal.pipedrive_id,
                person_pipedrive_id: existingPerson.pipedrive_id,
                done: false,
                due_date: followUpDate,
                due_time: followUpTime,
                note: `Follow-up automático`,
                raw_data: followResult.data,
              }, { onConflict: "pipedrive_id" });
            }

            // --- D) ADD QUALIFICATION NOTE ---
            if (parsed.qualification_data?.name || parsed.qualification_data?.business_type) {
              const qualData = parsed.qualification_data;
              await fetch(`${PIPE_BASE}/notes?api_token=${PIPEDRIVE_API_TOKEN}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deal_id: deal.pipedrive_id,
                  content: `🤖 SDR IA — Qualificação automática\n\nNome: ${qualData.name || "—"}\nNegócio: ${qualData.business_type || "—"}\nFaturamento: ${qualData.revenue || "—"}\nDor: ${qualData.pain || "—"}\nDecisão: ${qualData.decision_maker ? "Sim" : "Não"}\n\nScore: ${parsed.lead_score} (${parsed.lead_score_value}/100)\nMotivo: ${parsed.lead_score_reason || "—"}`,
                }),
              });
              console.log("[ai-sdr] Pipedrive qualification note added");
            }

            // --- E) UPDATE PERSON NAME ---
            if (parsed.qualification_data?.name) {
              await fetch(`${PIPE_BASE}/persons/${existingPerson.pipedrive_id}?api_token=${PIPEDRIVE_API_TOKEN}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: parsed.qualification_data.name }),
              });
            }
          }
        }
      } catch (pipeErr) {
        console.error("[ai-sdr] Pipedrive sync error:", pipeErr);
      }
    }

    // 9. Auto follow-up scheduling (for no-response cases)
    // ===== BUG FIX: Only schedule generic follow-up if meeting was NOT confirmed =====
    // When meeting_confirmed=true, follow-ups are already created in section 7 (6h and 1h before)
    if (parsed.schedule_follow_up && !parsed.meeting_confirmed && conversation?.contact_id) {
      // Check if there's already a pending follow-up for this conversation to avoid duplicates
      const { count: existingReminders } = await supabase
        .from("wa_follow_up_reminders")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversation_id)
        .eq("completed", false)
        .gte("remind_at", new Date().toISOString());

      if ((existingReminders || 0) >= 2) {
        console.log("[ai-sdr] Skipping follow-up: already has", existingReminders, "pending reminders");
      } else {
        const validCreator = instance.sdr_id || instance.closer_id;
        if (!validCreator) {
          console.warn("[ai-sdr] Cannot schedule follow-up: no sdr_id or closer_id on instance");
        } else {
          const nextBizTime = getNextBusinessDateTime(new Date(), followUpHours);
          const remindAt = nextBizTime.toISOString();
          const followUpMsg = parsed.follow_up_message || `Fala ${contact_name || ""}! Sumiu 😄 Conseguiu pensar sobre o que conversamos?`;
          
          await supabase.from("wa_follow_up_reminders").insert({
            contact_id: conversation.contact_id,
            conversation_id,
            remind_at: remindAt,
            note: followUpMsg,
            created_by: validCreator,
          });
          console.log("[ai-sdr] Follow-up scheduled for", remindAt, "(business hours)");
        }
      }
    }

    // 10. Time escalation: alert manager if lead hasn't responded in X hours
    if (features.time_escalation && conversation?.contact_id) {
      const escalationHours = config.escalation_hours || 48;
      const { data: lastContactMsg } = await supabase
        .from("wa_messages")
        .select("created_at")
        .eq("conversation_id", conversation_id)
        .eq("sender", "contact")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastContactMsg) {
        const lastContactTime = new Date(lastContactMsg.created_at).getTime();
        const hoursElapsed = (Date.now() - lastContactTime) / (1000 * 60 * 60);
        
        if (hoursElapsed >= escalationHours) {
          // Check if we already sent this escalation
          const { count: existingEscalation } = await supabase
            .from("proactive_alerts")
            .select("*", { count: "exact", head: true })
            .eq("alert_type", "time_escalation")
            .eq("data->>conversation_id", conversation_id)
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          if (!existingEscalation) {
            const managerId = instance.closer_id || instance.sdr_id;
            if (managerId) {
              await supabase.from("proactive_alerts").insert({
                member_id: managerId,
                title: "⏰ Lead sem resposta — Escalonamento",
                message: `O lead ${contact_name || contact_phone} não responde há ${Math.round(hoursElapsed)}h.\n\nÚltima mensagem do lead: ${lastContactMsg.created_at}\nConversa: ${conversation_id}`,
                severity: "high",
                alert_type: "time_escalation",
                data: { conversation_id, contact_phone, hours_elapsed: Math.round(hoursElapsed) },
              });
              console.log("[ai-sdr] Time escalation alert sent after", Math.round(hoursElapsed), "hours");
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      reply: reply.substring(0, 100),
      parts_sent: replyParts.length,
      lead_score: parsed.lead_score || null,
      lead_score_value: parsed.lead_score_value || null,
      status_changed: parsed.new_lead_status || null,
      tags_added: parsed.add_tags || [],
      tags_removed: parsed.remove_tags || [],
      handoff: parsed.should_handoff || false,
      handoff_type: parsed.handoff_type || null,
      schedule_meeting: parsed.schedule_meeting || false,
      meeting_confirmed: parsed.meeting_confirmed || false,
      urgent_call: parsed.urgent_call || false,
      follow_up_scheduled: parsed.schedule_follow_up || false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-sdr] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
