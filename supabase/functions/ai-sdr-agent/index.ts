import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  
  // If after 19h BRT, move to next business day 9am
  brtHour = getBrtHour(result);
  if (brtHour >= 19) {
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
    const { conversation_id, instance_id, contact_phone, instance_name, contact_name, incoming_message, trigger_type, pipedrive_context } = body;

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
    };

    if (!features.auto_reply && !isProactive) {
      return new Response(JSON.stringify({ skipped: "auto_reply disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== BUG FIX #1: STOP AI AFTER HANDOFF =====
    // If lead_status is "agendado", the closer took over — AI must NOT respond
    {
      const { data: convCheck } = await supabase
        .from("wa_conversations")
        .select("lead_status")
        .eq("id", conversation_id)
        .single();

      if (convCheck?.lead_status === "agendado" && !isProactive) {
        console.log("[ai-sdr] Skipping: lead status is 'agendado' — human takeover active");
        return new Response(JSON.stringify({ skipped: "human_takeover_agendado" }), {
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

      if (recentHumanMsg && !isProactive) {
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
      const endHour = config.business_hours_end ?? 19;

      if (brtDay === 0 || brtDay === 6 || brtHour < startHour || brtHour >= endHour) {
        console.log(`[ai-sdr] Skipping: outside business hours (BRT ${brtHour}h, day ${brtDay})`);
        return new Response(JSON.stringify({ skipped: "outside_business_hours" }), {
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
    if (features.rate_limit && !isProactive) {
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

    // CONCURRENCY GUARD
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

    // Get Pipedrive deal context
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

    const qualificationQuestions = config.qualification_questions || [
      "Como posso te chamar?",
      "Qual tipo de negócio você atua?",
      "Qual o faturamento mensal aproximado?",
      "Já tem processo comercial estruturado?",
    ];
    const scoreThresholds = config.score_thresholds || { a_min: 80, b_min: 50 };
    const followUpHours = config.follow_up_hours || 24;

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
- Retorne "meeting_confirmed": true e "meeting_datetime": "data e hora confirmada"
- Finalize a conversa de forma positiva: "Perfeito! Anotado aqui. Te ligo [dia] às [hora]! 🤝"
- NÃO continue a conversa após confirmar. Apenas encerre.
- O sistema vai agendar follow-ups automáticos de 6h e 1h antes da ligação.

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
- Na primeira interação proativa, mude para "em_contato"
- SEMPRE retorne "new_lead_status" quando o status mudar

ATIVIDADES NO CRM:
- Após CADA interação, o sistema cria automaticamente uma atividade "feita" com resumo
- Também cria um follow-up de 24h (horário comercial) como "não feita"
- Inclua "activity_note" com um resumo curto da interação (1-2 frases)

Responda EXATAMENTE neste formato JSON:
{
  "reply": "Primeira parte|||Segunda parte|||Terceira parte",
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
  "meeting_suggestion": "",
  "meeting_confirmed": false,
  "meeting_datetime": "",
  "urgent_call": false,
  "schedule_follow_up": false,
  "follow_up_message": "",
  "activity_note": "Resumo curto da interação"${features.sentiment ? ',\n  "sentiment": "positivo" | "neutro" | "negativo" | "urgente"' : ""}${features.language_detection ? ',\n  "detected_language": "pt" | "en" | "es" | "other"' : ""}${features.linkedin_lookup ? ',\n  "linkedin_lookup": false,\n  "linkedin_query": ""' : ""}
}`;
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

      userMessage = `Este é um NOVO LEAD que acabou de ser cadastrado no CRM (Pipedrive). Você deve iniciar a conversa proativamente pelo WhatsApp.

ORIGEM DO LEAD: ${sourceName}

CONTEXTO DO LEAD:
- Nome: ${contact_name || "Não informado"}
- Telefone: ${contact_phone}
- Deal: ${pCtx.deal_title || "N/A"}
- Valor: ${pCtx.deal_value || 0}
- Origem: ${pCtx.origin || "Manual"}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ""}

${finalSourceContext ? `INSTRUÇÕES ESPECÍFICAS PARA ESTA ORIGEM (siga à risca):\n${finalSourceContext}\n` : ""}
INSTRUÇÕES GERAIS PARA PRIMEIRA MENSAGEM:
1. Adapte a abordagem ao contexto da origem (${sourceName}) — cada origem tem um tom diferente
2. Seja natural e pessoal — use o primeiro nome do lead
3. NÃO faça pitch direto — gere curiosidade e abra a conversa
4. Termine com uma pergunta aberta para engajar o lead
5. Mantenha a mensagem curta (máximo 4 linhas)
6. Varie o estilo: às vezes mais direto, às vezes mais descontraído — não use sempre o mesmo template

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
      return new Response(JSON.stringify({ error: "All AI models failed or returned empty reply" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split reply into multiple messages using "|||" separator
    const replyParts = reply.split("|||").map(p => p.trim()).filter(p => p.length > 0);
    console.log(`[ai-sdr] Reply split into ${replyParts.length} parts`);

    // Send each part with human-like random delays
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY && features.auto_reply) {
      const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
      const fullReply: string[] = [];

      for (let i = 0; i < replyParts.length; i++) {
        const part = replyParts[i];

        // Human-like random delay: 1-5 seconds between messages
        const delay = Math.floor(Math.random() * 4000) + 1000;
        console.log(`[ai-sdr] Part ${i + 1}/${replyParts.length}: waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));

        const sendResp = await fetch(`${baseUrl}/message/sendText/${instName}`, {
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

      // Save all parts as individual messages in DB
      for (const part of fullReply) {
        await supabase.from("wa_messages").insert({
          conversation_id, instance_id, sender: "agent",
          agent_name: "SDR IA 🤖", text: part,
        });
      }

      // Update conversation with last message
      const lastPart = fullReply[fullReply.length - 1] || reply;
      await supabase.from("wa_conversations").update({
        last_message: lastPart,
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

      // Mark conversation for human takeover
      await supabase.from("wa_conversations").update({
        lead_status: "agendado",
        assigned_to: instance.closer_id,
        assigned_role: "closer",
      }).eq("id", conversation_id);

      // Disable AI for this conversation by updating status
      // The AI won't respond anymore because we set lead_status to "agendado"
    }

    // 7. Meeting confirmed: schedule 6h and 1h follow-ups
    if (parsed.meeting_confirmed && conversation?.contact_id) {
      console.log("[ai-sdr] Meeting confirmed:", parsed.meeting_datetime);

      // Try to parse the meeting datetime
      let meetingTime: Date | null = null;
      if (parsed.meeting_datetime) {
        try {
          // Try various formats
          meetingTime = new Date(parsed.meeting_datetime);
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
              const statusToOrder: Record<string, number> = {
                "novo": 0,
                "em_contato": 1,
                "qualificado": 2,
                "agendado": 3,
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
    // ===== BUG FIX #2 & #7: Use valid team_member_id and respect business hours =====
    if (parsed.schedule_follow_up && conversation?.contact_id) {
      const validCreator = instance.sdr_id || instance.closer_id;
      if (!validCreator) {
        console.warn("[ai-sdr] Cannot schedule follow-up: no sdr_id or closer_id on instance");
      } else {
        // BUG FIX #7: Use business datetime instead of raw hours addition
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
