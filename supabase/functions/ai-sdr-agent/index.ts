import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const { conversation_id, instance_id, contact_phone, instance_name, contact_name, incoming_message, trigger_type } = body;

    // trigger_type: "incoming" (default) or "proactive" (pipedrive trigger)
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

    const config = instance.ai_sdr_config || {};
    const instName = instance_name || instance.instance_name;

    // Get closer name to impersonate
    let closerName = "";
    if (instance.closer_id) {
      const { data: closerMember } = await supabase
        .from("team_members")
        .select("name")
        .eq("id", instance.closer_id)
        .single();
      closerName = closerMember?.name || "";
    }

    // Check feature toggles
    const features = {
      auto_reply: config.feature_auto_reply !== false,
      auto_tag: config.feature_auto_tag !== false,
      qualification: config.feature_qualification !== false,
      handoff: config.feature_handoff !== false,
      sentiment: config.feature_sentiment === true,
      pipedrive_sync: config.feature_pipedrive_sync === true,
    };

    // If auto_reply is off and this is not a proactive trigger, skip
    if (!features.auto_reply && !isProactive) {
      return new Response(JSON.stringify({ skipped: "auto_reply disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation history
    const { data: messages } = await supabase
      .from("wa_messages")
      .select("sender, text, created_at")
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

    // Check handoff threshold
    if (features.handoff) {
      const agentMsgCount = history.filter(m => m.sender === "agent").length;
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

    // Get ALL knowledge: company_knowledge (active) + ai_prompts
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

    // Get closer's calendar availability if qualification feature is on
    let calendarContext = "";
    if (features.qualification && instance.closer_id) {
      try {
        // Find user_id linked to closer
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
            // Check if token needs refresh
            let accessToken = calToken.access_token;
            const expiresAt = new Date(calToken.token_expires_at);
            if (expiresAt < new Date()) {
              // Refresh token
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

            // Fetch next 3 days availability
            const now = new Date();
            const timeMin = now.toISOString();
            const timeMax = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

            const calResp = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=20`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (calResp.ok) {
              const calData = await calResp.json();
              const busySlots = (calData.items || [])
                .filter((e: any) => e.status !== "cancelled")
                .map((e: any) => {
                  const start = new Date(e.start?.dateTime || e.start?.date);
                  const end = new Date(e.end?.dateTime || e.end?.date);
                  return `${start.toLocaleDateString("pt-BR")} ${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}-${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                });

              calendarContext = `\n\nAGENDA DO CLOSER (próximos 3 dias - horários OCUPADOS):\n${busySlots.join("\n") || "Agenda livre"}\n\nHorário comercial: 9h às 18h, Seg-Sex. Sugira horários LIVRES (que não conflitem com os ocupados acima). Ofereça 3 opções.`;
            }
          }
        }
      } catch (calErr) {
        console.error("[ai-sdr] Calendar error:", calErr);
      }
    }

    // Get Pipedrive deal context if sync is enabled
    let pipedriveContext = "";
    if (features.pipedrive_sync && conversation?.contact_id) {
      try {
        const { data: pipeContact } = await supabase
          .from("pipedrive_persons")
          .select("pipedrive_id, name, org_name")
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
        }
      } catch (pipeErr) {
        console.error("[ai-sdr] Pipedrive context error:", pipeErr);
      }
    }

    // Build qualification questions config
    const qualificationQuestions = config.qualification_questions || [
      "Como posso te chamar?",
      "Qual tipo de negócio você atua?",
      "Qual o faturamento mensal aproximado?",
      "Já tem processo comercial estruturado?",
    ];
    const scoreThresholds = config.score_thresholds || { a_min: 80, b_min: 50 };

    // Build the master system prompt
    const masterPrompt = config.master_prompt || "";
    const identityLine = closerName
      ? `Você é ${closerName}, especialista comercial. O lead DEVE acreditar que está falando diretamente com ${closerName}. Use primeira pessoa. NUNCA mencione que é IA, assistente virtual ou bot.`
      : `Você é uma SDR (Sales Development Representative) virtual de IA integrada ao WhatsApp.`;
    const systemPrompt = `${masterPrompt ? `REGRAS ABSOLUTAS DO GESTOR (prioridade máxima):\n${masterPrompt}\n\n` : ""}${identityLine}

CONHECIMENTO DO NEGÓCIO:
${aiPrompts || ""}

${generalKnowledge ? `INFORMAÇÕES DA EMPRESA:\n${generalKnowledge}` : ""}

${config.prompt_context ? `INSTRUÇÕES ADICIONAIS:\n${config.prompt_context}` : ""}

SEU OBJETIVO:
- Responder de forma natural e humana ao lead pelo WhatsApp
- Qualificar o lead usando as perguntas de qualificação
- Classificar o lead com um SCORE (A, B ou C)
- Lead A (score >= ${scoreThresholds.a_min}): Qualificado — agendar reunião direto com o Closer
- Lead B (score >= ${scoreThresholds.b_min}): Parcialmente qualificado — transferir para SDR humano
- Lead C (score < ${scoreThresholds.b_min}): Não qualificado — encerrar educadamente com conteúdo

PERGUNTAS DE QUALIFICAÇÃO (faça de forma natural, NÃO como formulário):
${qualificationQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

TOM: ${config.tone || "profissional"}
${calendarContext}
${pipedriveContext}

ETIQUETAS DISPONÍVEIS: ${availableTagNames.join(", ")}
ETIQUETAS ATUAIS: ${currentTagNames.length > 0 ? currentTagNames.join(", ") : "Nenhuma"}
STATUS ATUAL: ${conversation?.lead_status || "novo"}

REGRAS:
1. NUNCA invente informações sobre produtos/serviços que não estão no contexto
2. Responda de forma concisa (máximo 3 parágrafos curtos)
3. Use formatação WhatsApp: *negrito*, _itálico_
4. Use emojis com moderação
5. Se o lead perguntar algo fora do escopo, diga que vai verificar com a equipe
6. NUNCA revele que é uma IA
7. Se o lead estiver irritado ou pedir para falar com humano, faça handoff imediato

${features.sentiment ? "ANÁLISE DE SENTIMENTO: Analise o sentimento do lead (positivo, neutro, negativo, urgente) e inclua no JSON." : ""}

Responda EXATAMENTE neste formato JSON:
{
  "reply": "Sua mensagem de resposta aqui",
  "new_lead_status": "novo" | "em_contato" | "qualificado" | "agendado" | "perdido" | null,
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
  "meeting_suggestion": ""${features.sentiment ? ',\n  "sentiment": "positivo" | "neutro" | "negativo" | "urgente"' : ""}${features.pipedrive_sync ? ',\n  "pipedrive_update": { "stage": "", "value": 0, "custom_fields": {} }' : ""}
}`;

    const userMessage = isProactive
      ? `Este é um NOVO LEAD que acabou de entrar no funil via Pipedrive. Inicie a conversa proativamente com a saudação configurada. Nome do lead: ${contact_name || "Não informado"}. Telefone: ${contact_phone}.`
      : `HISTÓRICO DA CONVERSA:\n${conversationText}\n\nÚLTIMA MENSAGEM DO LEAD:\n${incoming_message}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[ai-sdr] AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI rate limit or credits" }), {
          status: aiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { reply: content.replace(/```json|```/g, "").trim() };
    }

    const reply = parsed.reply || "";
    if (!reply) {
      return new Response(JSON.stringify({ error: "AI returned empty reply" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Send message via Evolution API
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY && features.auto_reply) {
      const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
      const sendResp = await fetch(`${baseUrl}/message/sendText/${instName}`, {
        method: "POST",
        headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ number: contact_phone, text: reply }),
      });

      if (!sendResp.ok) {
        console.error("[ai-sdr] Send error:", sendResp.status, await sendResp.text());
      } else {
        console.log("[ai-sdr] Message sent to", contact_phone);
      }

      await supabase.from("wa_messages").insert({
        conversation_id, instance_id, sender: "agent",
        agent_name: "SDR IA 🤖", text: reply,
      });

      await supabase.from("wa_conversations").update({
        last_message: reply,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      }).eq("id", conversation_id);
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
      // Update lead score in wa_lead_scores
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

    // 6. Pipedrive sync
    if (features.pipedrive_sync && PIPEDRIVE_API_TOKEN && parsed.qualification_data) {
      try {
        const qualData = parsed.qualification_data;

        // Find or check existing person in Pipedrive
        const { data: existingPerson } = await supabase
          .from("pipedrive_persons")
          .select("pipedrive_id")
          .eq("wa_contact_id", conversation?.contact_id || "")
          .single();

        if (existingPerson?.pipedrive_id) {
          // Update person name if we learned it
          if (qualData.name) {
            await fetch(`https://api.pipedrive.com/v1/persons/${existingPerson.pipedrive_id}?api_token=${PIPEDRIVE_API_TOKEN}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: qualData.name }),
            });
          }

          // Update deal stage if pipedrive_update provided
          if (parsed.pipedrive_update?.stage) {
            const { data: deals } = await supabase
              .from("pipedrive_deals")
              .select("pipedrive_id")
              .eq("person_id", existingPerson.pipedrive_id)
              .eq("status", "open")
              .limit(1);

            if (deals?.[0]) {
              // Add note with qualification data
              await fetch(`https://api.pipedrive.com/v1/notes?api_token=${PIPEDRIVE_API_TOKEN}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deal_id: deals[0].pipedrive_id,
                  content: `🤖 SDR IA — Qualificação automática\n\nNome: ${qualData.name || "—"}\nNegócio: ${qualData.business_type || "—"}\nFaturamento: ${qualData.revenue || "—"}\nDor: ${qualData.pain || "—"}\nDecisão: ${qualData.decision_maker ? "Sim" : "Não"}\n\nScore: ${parsed.lead_score} (${parsed.lead_score_value}/100)\nMotivo: ${parsed.lead_score_reason || "—"}`,
                }),
              });
            }
          }
        }
      } catch (pipeErr) {
        console.error("[ai-sdr] Pipedrive sync error:", pipeErr);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      reply: reply.substring(0, 100),
      lead_score: parsed.lead_score || null,
      lead_score_value: parsed.lead_score_value || null,
      status_changed: parsed.new_lead_status || null,
      tags_added: parsed.add_tags || [],
      tags_removed: parsed.remove_tags || [],
      handoff: parsed.should_handoff || false,
      handoff_type: parsed.handoff_type || null,
      schedule_meeting: parsed.schedule_meeting || false,
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
