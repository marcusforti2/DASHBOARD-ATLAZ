import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada. Configure nas configurações do projeto." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { flowId, immediate = true } = await req.json();
    if (!flowId) throw new Error("flowId é obrigatório");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: flow, error: flowError } = await supabase.from('email_flows').select('*').eq('id', flowId).single();
    if (flowError || !flow) throw new Error("Fluxo não encontrado");

    const nodes: any[] = flow.nodes || [];
    const audienceType = flow.audience_type || 'all';

    // Resolve recipients based on audience
    let query = supabase.from('team_members').select('id, name, email, member_role, phone').eq('active', true);
    if (audienceType === 'sdrs') query = query.eq('member_role', 'sdr');
    else if (audienceType === 'closers') query = query.eq('member_role', 'closer');

    const { data: members, error: membersError } = await query;
    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum membro da equipe encontrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = members.filter(m => m.email);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum membro com email encontrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve templates
    const templateIds = nodes.filter((n: any) => n.type === 'email' && n.data?.templateId).map((n: any) => n.data.templateId);
    let templateMap = new Map();
    if (templateIds.length > 0) {
      const { data: templates } = await supabase.from('email_templates').select('id, subject, body_html').in('id', templateIds);
      templateMap = new Map(templates?.map((t: any) => [t.id, t]) || []);
    }

    const emailNodes = nodes.filter((n: any) => n.type === 'email');
    if (emailNodes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum nó de email no fluxo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const replaceVars = (text: string, member: any) => {
      return text
        .replace(/\{\{nome\}\}/g, member.name || '')
        .replace(/\{\{email\}\}/g, member.email || '')
        .replace(/\{\{role\}\}/g, member.member_role === 'closer' ? 'Closer' : 'SDR');
    };

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const sendLogs: any[] = [];

    for (const recipient of recipients) {
      for (let i = 0; i < emailNodes.length; i++) {
        const node = emailNodes[i];
        let subject = node.data.subject || '';
        let body = node.data.body || '';

        if (node.data.templateId && templateMap.has(node.data.templateId)) {
          const tpl = templateMap.get(node.data.templateId);
          subject = tpl.subject;
          body = tpl.body_html;
        }

        if (!subject && !body) continue;

        const personalizedSubject = replaceVars(subject, recipient);
        const personalizedBody = replaceVars(body, recipient);

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
  .email-container { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
  .content { padding: 30px; }
  .footer { text-align: center; padding: 20px; background: #f3f4f6; font-size: 12px; color: #6b7280; }
  a { color: #6366f1; }
  .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 15px 0; }
</style></head><body>
  <div class="email-container">
    <div class="header"><h1>${personalizedSubject}</h1></div>
    <div class="content">${personalizedBody}</div>
    <div class="footer"><p>© ${new Date().getFullYear()} Learning Brand Sales Tracker</p></div>
  </div>
</body></html>`;

        if (successCount > 0 || errorCount > 0) await delay(600);

        try {
          const sendResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Learning Brand <noreply@resend.dev>",
              to: [recipient.email],
              subject: personalizedSubject,
              html: htmlContent,
            }),
          });

          if (sendResp.ok) {
            successCount++;
            sendLogs.push({
              flow_id: flowId,
              recipient_email: recipient.email,
              recipient_name: recipient.name || null,
              subject: personalizedSubject,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          } else {
            const errText = await sendResp.text();
            errorCount++;
            errors.push(`${recipient.email}: ${errText}`);
            sendLogs.push({
              flow_id: flowId,
              recipient_email: recipient.email,
              recipient_name: recipient.name || null,
              subject: personalizedSubject,
              status: 'failed',
              error_message: errText.substring(0, 500),
              sent_at: new Date().toISOString(),
            });
          }
        } catch (err: any) {
          errorCount++;
          errors.push(`${recipient.email}: ${err.message}`);
          sendLogs.push({
            flow_id: flowId,
            recipient_email: recipient.email,
            recipient_name: recipient.name || null,
            subject: personalizedSubject,
            status: 'failed',
            error_message: err.message?.substring(0, 500),
            sent_at: new Date().toISOString(),
          });
        }
      }

      // Legacy execution record per member
      try {
        await supabase.from('email_flow_executions').insert({
          flow_id: flowId,
          member_id: recipient.id,
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to record execution:', e);
      }
    }

    // Insert detailed send logs in batch
    if (sendLogs.length > 0) {
      try {
        await supabase.from('email_send_logs').insert(sendLogs);
      } catch (e) {
        console.error('Failed to insert send logs:', e);
      }
    }

    const totalEmails = recipients.length * emailNodes.length;
    const message = errorCount > 0
      ? `${successCount} de ${totalEmails} email(s) enviados. ${errorCount} falharam.`
      : `${successCount} email(s) enviados para ${recipients.length} membro(s) com sucesso!`;

    return new Response(JSON.stringify({ success: errorCount === 0, message, stats: { total: totalEmails, sent: successCount, failed: errorCount } }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("execute-email-flow error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
