import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { flowId, content, fileName } = await req.json();
    if (!flowId || !content) {
      return new Response(JSON.stringify({ error: "flowId e content são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract emails from the raw text content
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an email extraction assistant. Extract all email addresses from the provided text/data. 
For each email found, also try to extract the associated name if available.
Return ONLY a valid JSON array of objects with "email" and "name" fields.
Example: [{"email":"john@example.com","name":"John Doe"},{"email":"jane@test.com","name":"Jane"}]
If no name is found, use null. Remove duplicates. Only return valid email addresses.
Do NOT include any markdown, code blocks, or explanation - ONLY the JSON array.`
          },
          {
            role: "user",
            content: `Extract all emails from this content (file: ${fileName || 'unknown'}):\n\n${content.substring(0, 50000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_emails",
              description: "Return extracted email contacts from the document",
              parameters: {
                type: "object",
                properties: {
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        email: { type: "string" },
                        name: { type: "string", nullable: true }
                      },
                      required: ["email"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["contacts"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_emails" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let contacts: { email: string; name: string | null }[] = [];

    // Parse from tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        contacts = parsed.contacts || [];
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }

    // Fallback: try parsing from content
    if (contacts.length === 0) {
      const msgContent = aiData.choices?.[0]?.message?.content;
      if (msgContent) {
        try {
          contacts = JSON.parse(msgContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
        } catch (e) {
          console.error("Failed to parse content:", e);
        }
      }
    }

    // Validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    contacts = contacts.filter(c => c.email && emailRegex.test(c.email.trim()));
    // Deduplicate
    const seen = new Set<string>();
    contacts = contacts.filter(c => {
      const lower = c.email.trim().toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    if (contacts.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum email válido encontrado no arquivo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into email_flow_contacts
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const rows = contacts.map(c => ({
      flow_id: flowId,
      email: c.email.trim().toLowerCase(),
      name: c.name || null,
      source_file: fileName || null,
    }));

    const { error: insertError } = await supabase.from('email_flow_contacts').insert(rows);
    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar contatos: " + insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      count: contacts.length,
      contacts: contacts.slice(0, 10), // preview
      message: `${contacts.length} email(s) importados com sucesso!`,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("parse-email-list error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
