import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    const instanceName = payload.instance?.instanceName || payload.instance || payload.instanceName || payload.data?.instance?.instanceName;

    console.log('[webhook] Event:', payload.event, 'Instance:', instanceName);
    if (!instanceName) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no instance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: instance } = await supabase
      .from('wa_instances')
      .select('id, closer_id')
      .eq('instance_name', instanceName)
      .single();

    if (!instance) {
      console.log('[webhook] Instance not found in DB:', instanceName);
      return new Response(JSON.stringify({ ok: true, skipped: 'instance not in DB' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = payload.event;

    if (event === 'messages.upsert') {
      const msgData = payload.data;
      if (!msgData?.key?.remoteJid || !msgData?.message) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no message data' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const remoteJid = msgData.key.remoteJid;
      if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
        return new Response(JSON.stringify({ ok: true, skipped: 'group or status' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const phone = remoteJid.replace('@s.whatsapp.net', '');
      const isFromMe = msgData.key.fromMe === true;
      const pushName = msgData.pushName || '';
      const messageText = extractMessageText(msgData.message);

      if (!messageText) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no text content' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert contact
      let { data: contact } = await supabase
        .from('wa_contacts').select('id')
        .eq('instance_id', instance.id).eq('phone', phone).single();

      if (!contact) {
        const { data: newContact } = await supabase
          .from('wa_contacts')
          .insert({ instance_id: instance.id, phone, name: pushName || phone })
          .select('id').single();
        contact = newContact;
      } else if (pushName && pushName !== phone) {
        await supabase.from('wa_contacts')
          .update({ name: pushName, updated_at: new Date().toISOString() })
          .eq('id', contact.id);
      }

      if (!contact) {
        return new Response(JSON.stringify({ ok: false, error: 'contact upsert failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert conversation
      let { data: conversation } = await supabase
        .from('wa_conversations').select('id, unread_count')
        .eq('contact_id', contact.id).eq('instance_id', instance.id).single();

      const now = new Date().toISOString();

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('wa_conversations')
          .insert({
            contact_id: contact.id, instance_id: instance.id,
            assigned_to: instance.closer_id, assigned_role: 'closer',
            status: 'active', lead_status: 'novo',
            last_message: messageText, last_message_at: now,
            unread_count: isFromMe ? 0 : 1,
          })
          .select('id, unread_count').single();
        conversation = newConv;
      } else {
        await supabase.from('wa_conversations')
          .update({
            last_message: messageText, last_message_at: now,
            unread_count: isFromMe ? 0 : (conversation.unread_count || 0) + 1,
            status: 'active',
          })
          .eq('id', conversation.id);
      }

      if (!conversation) {
        return new Response(JSON.stringify({ ok: false, error: 'conversation upsert failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('wa_messages').insert({
        conversation_id: conversation.id, instance_id: instance.id,
        sender: isFromMe ? 'agent' : 'contact',
        agent_name: isFromMe ? (msgData.pushName || 'Closer') : null,
        agent_id: isFromMe ? instance.closer_id : null,
        text: messageText,
        created_at: msgData.messageTimestamp
          ? new Date(msgData.messageTimestamp * 1000).toISOString()
          : now,
      });

      console.log('[webhook] Message saved:', isFromMe ? 'sent' : 'received', phone, messageText.substring(0, 50));
    }

    if (event === 'connection.update') {
      const state = payload.data?.state;
      if (state) {
        await supabase.from('wa_instances')
          .update({ is_connected: state === 'open' })
          .eq('id', instance.id);
        console.log('[webhook] Connection update:', instanceName, state);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[webhook] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractMessageText(message: Record<string, unknown>): string {
  if (!message) return '';
  if (typeof message.conversation === 'string') return message.conversation;
  if (typeof message.extendedTextMessage === 'object' && message.extendedTextMessage) {
    return (message.extendedTextMessage as Record<string, unknown>).text as string || '';
  }
  if (typeof message.imageMessage === 'object' && message.imageMessage) {
    return (message.imageMessage as Record<string, unknown>).caption as string || '📷 Imagem';
  }
  if (typeof message.videoMessage === 'object' && message.videoMessage) {
    return (message.videoMessage as Record<string, unknown>).caption as string || '🎥 Vídeo';
  }
  if (typeof message.audioMessage === 'object') return '🎵 Áudio';
  if (typeof message.documentMessage === 'object' && message.documentMessage) {
    return `📄 ${(message.documentMessage as Record<string, unknown>).fileName || 'Documento'}`;
  }
  if (typeof message.stickerMessage === 'object') return '🎨 Sticker';
  if (typeof message.locationMessage === 'object') return '📍 Localização';
  if (typeof message.contactMessage === 'object') return '👤 Contato';
  return '';
}
