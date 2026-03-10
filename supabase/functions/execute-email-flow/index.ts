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

        const year = new Date().getFullYear();
        const firstName = (recipient.name || '').split(' ')[0] || 'Olá';

        const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${personalizedSubject}</title>
  <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f5;">
    <tr><td align="center" style="padding:24px 16px;">

      <!-- Main container 600px -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);">

        <!-- HERO HEADER with gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%);padding:48px 40px 40px;text-align:center;">
            <!-- Logo -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:linear-gradient(135deg,#c9a84c,#f0d78c);width:48px;height:48px;border-radius:12px;text-align:center;vertical-align:middle;">
                  <span style="color:#1a1a2e;font-size:20px;font-weight:800;letter-spacing:-1px;">LB</span>
                </td>
              </tr>
            </table>
            <!-- Subject as headline -->
            <h1 style="margin:0 0 12px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;letter-spacing:-0.3px;">${personalizedSubject}</h1>
            <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;font-weight:400;">Learning Brand · Sales Tracker</p>
          </td>
        </tr>

        <!-- GREETING -->
        <tr>
          <td style="background-color:#ffffff;padding:36px 40px 0;">
            <p style="margin:0;color:#1a1a2e;font-size:16px;font-weight:600;">Olá, ${firstName} 👋</p>
          </td>
        </tr>

        <!-- BODY CONTENT -->
        <tr>
          <td style="background-color:#ffffff;padding:20px 40px 32px;">
            <div style="color:#4a4a68;font-size:15px;line-height:1.7;">
              ${personalizedBody}
            </div>
          </td>
        </tr>

        <!-- ACCENT DIVIDER -->
        <tr>
          <td style="background-color:#ffffff;padding:0 40px;">
            <div style="height:3px;border-radius:2px;background:linear-gradient(90deg,#c9a84c 0%,#f0d78c 50%,#c9a84c 100%);"></div>
          </td>
        </tr>

        <!-- CTA SECTION -->
        <tr>
          <td style="background-color:#ffffff;padding:32px 40px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:linear-gradient(135deg,#1a1a2e,#0f3460);border-radius:12px;padding:14px 36px;">
                  <a href="#" style="color:#f0d78c;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase;">Acessar Dashboard →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;">
            <!-- Social icons row -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
              <tr>
                <td style="padding:0 8px;"><a href="#" style="display:inline-block;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);text-align:center;line-height:36px;color:#c9a84c;font-size:14px;text-decoration:none;">in</a></td>
                <td style="padding:0 8px;"><a href="#" style="display:inline-block;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);text-align:center;line-height:36px;color:#c9a84c;font-size:14px;text-decoration:none;">ig</a></td>
                <td style="padding:0 8px;"><a href="#" style="display:inline-block;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);text-align:center;line-height:36px;color:#c9a84c;font-size:14px;text-decoration:none;">yt</a></td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.5;">
              Abraços,<br><strong style="color:#f0d78c;">Equipe Learning Brand</strong>
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;line-height:1.5;">
              © ${year} Learning Brand · Todos os direitos reservados<br>
              Este email foi enviado automaticamente pelo Sales Tracker
            </p>
          </td>
        </tr>

      </table>
      <!-- /Main container -->

    </td></tr>
  </table>
</body>
</html>`;

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
