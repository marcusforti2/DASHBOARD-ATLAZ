import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { conversation_id, instance_id, contact_phone, instance_name, contact_name, incoming_message } = await req.json();

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

    // Get conversation history (last 20 messages for context)
    const { data: messages } = await supabase
      .from("wa_messages")
      .select("sender, text, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const history = (messages || []).reverse();

    // Get conversation details for lead_status
    const { data: conversation } = await supabase
      .from("wa_conversations")
      .select("lead_status, contact_id")
      .eq("id", conversation_id)
      .single();

    // Check if handoff threshold reached
    const agentMsgCount = history.filter(m => m.sender === "agent").length;
    const maxBeforeHandoff = config.max_messages_before_handoff || 10;
    if (agentMsgCount >= maxBeforeHandoff) {
      console.log("[ai-sdr] Handoff threshold reached, skipping auto-reply");
      // Notify — update conversation to flag for human review
      await supabase.from("wa_conversations").update({
        lead_status: "qualificado",
      }).eq("id", conversation_id);
      return new Response(JSON.stringify({ skipped: "handoff_threshold", handoff: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get available tags for context
    const { data: tags } = await supabase
      .from("wa_tags")
      .select("id, name, is_stage, sort_order")
      .order("sort_order");

    // Get current tags for this contact
    const { data: currentTags } = await supabase
      .from("wa_contact_tags")
      .select("tag_id, wa_tags(name)")
      .eq("contact_id", conversation?.contact_id || "");

    // Get company knowledge for context
    const { data: knowledge } = await supabase
      .from("company_knowledge")
      .select("title, content")
      .eq("active", true)
      .limit(3);

    const knowledgeContext = (knowledge || [])
      .map(k => `[${k.title}]: ${k.content.substring(0, 500)}`)
      .join("\n\n");

    // Build conversation history for AI
    const conversationText = history
      .map(m => `${m.sender === "contact" ? contact_name || "Lead" : "SDR IA"}: ${m.text}`)
      .join("\n");

    const currentTagNames = (currentTags || []).map((ct: any) => ct.wa_tags?.name).filter(Boolean);
    const availableTagNames = (tags || []).map(t => `${t.name}${t.is_stage ? " (estágio)" : ""}`);

    const systemPrompt = `Você é uma SDR (Sales Development Representative) virtual de IA integrada ao WhatsApp de uma empresa de vendas B2B.

CONTEXTO DA EMPRESA:
${knowledgeContext || "Empresa de vendas B2B focada em prospecção e qualificação de leads."}

${config.prompt_context ? `INSTRUÇÕES ADICIONAIS DO GESTOR:\n${config.prompt_context}\n` : ""}

SEU OBJETIVO:
- Responder de forma natural e humana ao lead pelo WhatsApp
- Qualificar o interesse do lead (entender necessidade, orçamento, timing)
- Agendar uma reunião/ligação com o Closer quando o lead estiver qualificado
- Manter o lead engajado e interessado

TOM: ${config.tone || "profissional"}

ETIQUETAS DISPONÍVEIS NO CRM:
${availableTagNames.join(", ")}

ETIQUETAS ATUAIS DO LEAD:
${currentTagNames.length > 0 ? currentTagNames.join(", ") : "Nenhuma"}

STATUS ATUAL DO LEAD: ${conversation?.lead_status || "novo"}

REGRAS:
1. NUNCA invente informações sobre produtos/serviços que não estão no contexto
2. Responda de forma concisa (máximo 3 parágrafos curtos)
3. Use formatação WhatsApp: *negrito*, _itálico_
4. Use emojis com moderação
5. Se o lead perguntar algo fora do escopo, diga que vai verificar com a equipe
6. Se o lead demonstrar interesse claro, sugira agendar uma reunião
7. NUNCA revele que é uma IA

IMPORTANTE - ANÁLISE DE ETIQUETAS:
Após gerar sua resposta, analise a conversa e decida se alguma etiqueta deve ser adicionada ou o status do lead deve mudar.

Responda EXATAMENTE neste formato JSON:
{
  "reply": "Sua mensagem de resposta aqui",
  "new_lead_status": "novo" | "em_contato" | "qualificado" | "agendado" | "perdido" | null,
  "add_tags": ["nome_da_tag"],
  "remove_tags": ["nome_da_tag"],
  "should_handoff": false,
  "handoff_reason": ""
}

Se should_handoff=true, a conversa será transferida para um humano.`;

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
          { role: "user", content: `HISTÓRICO DA CONVERSA:\n${conversationText}\n\nÚLTIMA MENSAGEM DO LEAD:\n${incoming_message}` },
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
      // Fallback: use content as reply directly
      parsed = { reply: content.replace(/```json|```/g, "").trim() };
    }

    const reply = parsed.reply || "";
    if (!reply) {
      return new Response(JSON.stringify({ error: "AI returned empty reply" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Send message via Evolution API
    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
      const sendResp = await fetch(`${baseUrl}/message/sendText/${instName}`, {
        method: "POST",
        headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          number: contact_phone,
          text: reply,
        }),
      });

      if (!sendResp.ok) {
        const sendErr = await sendResp.text();
        console.error("[ai-sdr] Send error:", sendResp.status, sendErr);
      } else {
        console.log("[ai-sdr] Message sent to", contact_phone);
      }

      // Save sent message to DB
      await supabase.from("wa_messages").insert({
        conversation_id,
        instance_id,
        sender: "agent",
        agent_name: "SDR IA 🤖",
        text: reply,
      });

      // Update conversation
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
      console.log("[ai-sdr] Lead status updated to:", parsed.new_lead_status);
    }

    // 3. Auto-update tags
    if (config.auto_tag && conversation?.contact_id && tags) {
      const tagMap = new Map(tags.map(t => [t.name.toLowerCase(), t.id]));

      // Add tags
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

      // Remove tags
      if (parsed.remove_tags?.length) {
        for (const tagName of parsed.remove_tags) {
          const tagId = tagMap.get(tagName.toLowerCase());
          if (tagId) {
            await supabase.from("wa_contact_tags")
              .delete()
              .eq("contact_id", conversation.contact_id)
              .eq("tag_id", tagId);
            console.log("[ai-sdr] Tag removed:", tagName);
          }
        }
      }
    }

    // 4. Handle handoff to human
    if (parsed.should_handoff) {
      await supabase.from("wa_conversations").update({
        lead_status: "qualificado",
      }).eq("id", conversation_id);

      // Create an alert for the closer/sdr
      const responsibleId = instance.closer_id || instance.sdr_id;
      if (responsibleId) {
        await supabase.from("proactive_alerts").insert({
          member_id: responsibleId,
          title: "🤖 Handoff: Lead qualificado",
          message: `A SDR IA transferiu o lead ${contact_name || contact_phone} para atendimento humano. Motivo: ${parsed.handoff_reason || "Lead qualificado para próximo passo."}`,
          severity: "high",
          alert_type: "ai_handoff",
        });
      }
      console.log("[ai-sdr] Handoff triggered for", contact_phone);
    }

    return new Response(JSON.stringify({
      ok: true,
      reply: reply.substring(0, 100),
      status_changed: parsed.new_lead_status || null,
      tags_added: parsed.add_tags || [],
      tags_removed: parsed.remove_tags || [],
      handoff: parsed.should_handoff || false,
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
