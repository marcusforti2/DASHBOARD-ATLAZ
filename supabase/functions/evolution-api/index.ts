import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
  if (!EVOLUTION_API_URL) {
    return new Response(JSON.stringify({ error: 'EVOLUTION_API_URL not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  if (!EVOLUTION_API_KEY) {
    return new Response(JSON.stringify({ error: 'EVOLUTION_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');

  try {
    const { action, instanceName, data } = await req.json();

    let url = '';
    let method = 'GET';
    let body: string | undefined;

    switch (action) {
      case 'list':
        url = `${baseUrl}/instance/fetchInstances`;
        method = 'GET';
        break;
      case 'create':
        url = `${baseUrl}/instance/create`;
        method = 'POST';
        body = JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true, ...data });
        break;
      case 'connect':
        url = `${baseUrl}/instance/connect/${instanceName}`;
        method = 'GET';
        break;
      case 'status':
        url = `${baseUrl}/instance/connectionState/${instanceName}`;
        method = 'GET';
        break;
      case 'disconnect':
        url = `${baseUrl}/instance/logout/${instanceName}`;
        method = 'DELETE';
        break;
      case 'delete':
        url = `${baseUrl}/instance/delete/${instanceName}`;
        method = 'DELETE';
        break;
      case 'restart':
        url = `${baseUrl}/instance/restart/${instanceName}`;
        method = 'PUT';
        break;
      case 'sendText':
        url = `${baseUrl}/message/sendText/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data);
        break;
      case 'sendMedia':
        url = `${baseUrl}/message/sendMedia/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data);
        break;
      case 'sendWhatsAppAudio':
        url = `${baseUrl}/message/sendWhatsAppAudio/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data);
        break;
      case 'sendSticker': {
        url = `${baseUrl}/message/sendSticker/${instanceName}`;
        method = 'POST';
        // Evolution API requires sticker as base64, not URL
        const stickerPayload: Record<string, unknown> = { number: data?.number };
        const imgSrc = data?.image as string | undefined;
        if (imgSrc && imgSrc.startsWith('http')) {
          try {
            const imgResp = await fetch(imgSrc);
            const imgBuf = await imgResp.arrayBuffer();
            const bytes = new Uint8Array(imgBuf);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
              for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
            }
            const b64 = btoa(binary);
            stickerPayload.sticker = `data:image/png;base64,${b64}`;
          } catch (e) {
            console.error('[evolution-api] Failed to fetch sticker image for base64 conversion:', e);
            stickerPayload.sticker = imgSrc;
          }
        } else if (imgSrc) {
          stickerPayload.sticker = imgSrc;
        }
        body = JSON.stringify(stickerPayload);
        break;
      }
      case 'setWebhook':
        url = `${baseUrl}/webhook/set/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data);
        break;
      case 'fetchChats':
        url = `${baseUrl}/chat/findChats/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data ?? {});
        break;
      case 'fetchContacts':
        url = `${baseUrl}/chat/findContacts/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data ?? {});
        break;
      case 'fetchMessages':
        url = `${baseUrl}/chat/findMessages/${instanceName}`;
        method = 'POST';
        body = JSON.stringify(data ?? {});
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    };
    if (body && (method === 'POST' || method === 'PUT')) fetchOptions.body = body;

    console.log(`[evolution-api] ${action} -> ${method} ${url}`);
    const response = await fetch(url, fetchOptions);
    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[evolution-api] Error [${response.status}]:`, JSON.stringify(responseData));
      return new Response(JSON.stringify({ error: responseData, status: response.status }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // After successful send, save the message to the database
    const sendActions = ['sendText', 'sendMedia', 'sendWhatsAppAudio', 'sendSticker'];
    if (sendActions.includes(action) && data?.number) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sb = createClient(supabaseUrl, supabaseKey);

        const { data: inst } = await sb
          .from('wa_instances')
          .select('id')
          .eq('instance_name', instanceName)
          .single();

        if (inst) {
          const phone = data.number.replace(/\D/g, '');

          let { data: contact } = await sb
            .from('wa_contacts')
            .select('id')
            .eq('phone', phone)
            .eq('instance_id', inst.id)
            .single();

          if (!contact) {
            const { data: newContact } = await sb
              .from('wa_contacts')
              .insert({ phone, instance_id: inst.id, name: phone })
              .select('id')
              .single();
            contact = newContact;
          }

          if (contact) {
            let { data: conv } = await sb
              .from('wa_conversations')
              .select('id')
              .eq('contact_id', contact.id)
              .eq('instance_id', inst.id)
              .single();

            if (!conv) {
              const { data: newConv } = await sb
                .from('wa_conversations')
                .insert({ contact_id: contact.id, instance_id: inst.id, status: 'active', lead_status: 'new' })
                .select('id')
                .single();
              conv = newConv;
            }

            if (conv) {
              let msgText = data.text || data.caption || '';
              let mediaType: string | null = null;
              let mediaUrl: string | null = null;
              let mediaMime: string | null = null;

              if (action === 'sendMedia') {
                mediaType = data.mediatype || 'image';
                mediaUrl = data.media || null;
                mediaMime = data.mimetype || null;
                if (!msgText) msgText = mediaType === 'image' ? '📷 Imagem' : mediaType === 'video' ? '🎥 Vídeo' : '📄 Documento';
              } else if (action === 'sendWhatsAppAudio') {
                mediaType = 'audio';
                mediaUrl = data.audio || null;
                mediaMime = 'audio/ogg';
                if (!msgText) msgText = '🎵 Áudio';
              } else if (action === 'sendSticker') {
                mediaType = 'sticker';
                mediaUrl = data.image || null;
                mediaMime = 'image/webp';
                if (!msgText) msgText = '🎨 Sticker';
              }

              await sb.from('wa_messages').insert({
                conversation_id: conv.id,
                instance_id: inst.id,
                sender: 'agent',
                text: msgText,
                media_type: mediaType,
                media_url: mediaUrl,
                media_mime_type: mediaMime,
              } as any);

              await sb.from('wa_conversations').update({
                last_message: msgText,
                last_message_at: new Date().toISOString(),
              }).eq('id', conv.id);

              console.log(`[evolution-api] ${action} message saved to DB for conv ${conv.id}`);
            }
          }
        }
      } catch (dbErr) {
        console.error('[evolution-api] Error saving sent message to DB:', dbErr);
      }
    }

    return new Response(JSON.stringify(responseData), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[evolution-api] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
