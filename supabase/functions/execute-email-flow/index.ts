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
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${personalizedSubject}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table,td{font-family:Arial,Helvetica,sans-serif!important}a{color:#c9a84c!important}</style>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    body { margin:0; padding:0; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .outer-td { padding: 16px 8px !important; }
      .main-table { width: 100% !important; }
      .hero-td { padding: 40px 24px 32px !important; }
      .content-td { padding: 24px !important; }
      .footer-td { padding: 24px !important; }
      .cta-btn { padding: 16px 28px !important; }
      h1 { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

  <!-- Preheader text (hidden) -->
  <div style="display:none;font-size:1px;color:#eef0f4;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${personalizedSubject} — Learning Brand Sales Tracker
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f4;">
    <tr><td align="center" class="outer-td" style="padding:32px 16px;">

      <!-- Container 600px -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="main-table" style="max-width:600px;width:100%;border-collapse:separate;border-spacing:0;">

        <!-- ═══════════ HERO HEADER ═══════════ -->
        <tr>
          <td class="hero-td" style="background:linear-gradient(145deg,#0a0e27 0%,#111640 35%,#1a2366 70%,#0f3460 100%);padding:52px 44px 44px;text-align:center;border-radius:20px 20px 0 0;">

            <!-- Logo Badge -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="width:56px;height:56px;border-radius:16px;text-align:center;vertical-align:middle;background:linear-gradient(135deg,#d4af37 0%,#f5e6a3 50%,#c9a84c 100%);box-shadow:0 4px 20px rgba(201,168,76,0.4);">
                  <span style="color:#0a0e27;font-size:22px;font-weight:800;letter-spacing:-1px;font-family:'Inter',Arial,sans-serif;">LB</span>
                </td>
              </tr>
            </table>

            <!-- Decorative tag -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
              <tr>
                <td style="background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:20px;padding:6px 18px;">
                  <span style="color:#f0d78c;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;font-family:'Inter',Arial,sans-serif;">Sales Tracker</span>
                </td>
              </tr>
            </table>

            <!-- Headline -->
            <h1 style="margin:0 0 16px;color:#ffffff;font-size:28px;font-weight:800;line-height:1.25;letter-spacing:-0.5px;font-family:'Inter',Arial,sans-serif;">${personalizedSubject}</h1>
            
            <!-- Subtle separator -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="width:48px;height:3px;border-radius:2px;background:linear-gradient(90deg,#c9a84c,#f0d78c);"></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ GREETING CARD ═══════════ -->
        <tr>
          <td style="background-color:#ffffff;padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="content-td" style="padding:36px 44px 8px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Avatar circle -->
                      <td style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0a0e27,#1a2366);text-align:center;vertical-align:middle;">
                        <span style="color:#f0d78c;font-size:18px;font-weight:700;font-family:'Inter',Arial,sans-serif;">${firstName.charAt(0).toUpperCase()}</span>
                      </td>
                      <td style="padding-left:14px;">
                        <p style="margin:0;color:#0a0e27;font-size:17px;font-weight:700;font-family:'Inter',Arial,sans-serif;">Olá, ${firstName}! 👋</p>
                        <p style="margin:4px 0 0;color:#8b8fa3;font-size:13px;font-weight:400;font-family:'Inter',Arial,sans-serif;">Temos novidades para você</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ BODY CONTENT ═══════════ -->
        <tr>
          <td style="background-color:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td class="content-td" style="padding:20px 44px 12px;">
                  <!-- Content card with subtle bg -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:14px;border:1px solid #eef0f4;">
                    <tr>
                      <td style="padding:28px 28px;">
                        <div style="color:#3a3d52;font-size:15px;line-height:1.75;font-family:'Inter',Arial,sans-serif;">
                          ${personalizedBody}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ CTA BUTTON ═══════════ -->
        <tr>
          <td style="background-color:#ffffff;padding:24px 44px 36px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td class="cta-btn" style="background:linear-gradient(135deg,#0a0e27 0%,#1a2366 100%);border-radius:14px;padding:16px 40px;box-shadow:0 6px 24px rgba(10,14,39,0.25);">
                  <a href="#" style="color:#f0d78c;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.8px;text-transform:uppercase;font-family:'Inter',Arial,sans-serif;">Acessar Dashboard &#8594;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ ACCENT STRIP ═══════════ -->
        <tr>
          <td style="background-color:#ffffff;padding:0;">
            <div style="height:4px;background:linear-gradient(90deg,#c9a84c 0%,#f0d78c 30%,#d4af37 60%,#c9a84c 100%);"></div>
          </td>
        </tr>

        <!-- ═══════════ FOOTER ═══════════ -->
        <tr>
          <td class="footer-td" style="background:linear-gradient(180deg,#0a0e27 0%,#070a1a 100%);padding:36px 44px;text-align:center;border-radius:0 0 20px 20px;">

            <!-- Social icons -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="padding:0 6px;"><a href="#" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);text-align:center;line-height:38px;color:#c9a84c;font-size:13px;font-weight:600;text-decoration:none;font-family:'Inter',Arial,sans-serif;">in</a></td>
                <td style="padding:0 6px;"><a href="#" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);text-align:center;line-height:38px;color:#c9a84c;font-size:13px;font-weight:600;text-decoration:none;font-family:'Inter',Arial,sans-serif;">ig</a></td>
                <td style="padding:0 6px;"><a href="#" style="display:inline-block;width:38px;height:38px;border-radius:10px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);text-align:center;line-height:38px;color:#c9a84c;font-size:13px;font-weight:600;text-decoration:none;font-family:'Inter',Arial,sans-serif;">yt</a></td>
              </tr>
            </table>

            <!-- Signature -->
            <p style="margin:0 0 6px;color:rgba(255,255,255,0.6);font-size:13px;font-weight:400;font-family:'Inter',Arial,sans-serif;">Abraços,</p>
            <p style="margin:0 0 20px;color:#f0d78c;font-size:14px;font-weight:700;font-family:'Inter',Arial,sans-serif;">Equipe Learning Brand</p>

            <!-- Divider -->
            <div style="height:1px;background:rgba(255,255,255,0.06);margin:0 0 20px;"></div>

            <!-- Legal -->
            <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;line-height:1.6;font-family:'Inter',Arial,sans-serif;">
              &copy; ${year} Learning Brand &middot; Todos os direitos reservados<br>
              Este email foi enviado automaticamente pelo Sales Tracker
            </p>
          </td>
        </tr>

      </table>
      <!-- /Container -->

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
