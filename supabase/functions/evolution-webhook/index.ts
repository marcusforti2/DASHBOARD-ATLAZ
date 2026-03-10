import { createClient } from "npm:@supabase/supabase-js@2.49.1";

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
      .select('id, closer_id, sdr_id, ai_sdr_enabled, ai_sdr_config, instance_name, phone')
      .eq('instance_name', instanceName)
      .single();

    if (!instance) {
      console.log('[webhook] Instance not found in DB:', instanceName);
      return new Response(JSON.stringify({ ok: true, skipped: 'instance not in DB' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = payload.event;

    // Handle connection status changes in real-time
    if (event === 'connection.update') {
      const state = payload.data?.state || payload.data?.status;
      const isConn = state === 'open' || state === 'connected';
      const instancePhone = payload.data?.ownerJid?.replace('@s.whatsapp.net', '') || null;
      const updateData: any = { is_connected: isConn };
      if (instancePhone && isConn) updateData.phone = instancePhone;
      await supabase.from('wa_instances').update(updateData).eq('id', instance.id);
      console.log(`[webhook] Connection update: ${instanceName} -> ${state} (is_connected=${isConn}, phone=${instancePhone})`);
      return new Response(JSON.stringify({ ok: true, connection: state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

      // Auto-populate instance phone from participant JID when sending messages
      if (isFromMe && msgData.key.participant) {
        const ownPhone = msgData.key.participant.replace('@s.whatsapp.net', '');
        if (ownPhone && !instance.phone) {
          await supabase.from('wa_instances').update({ phone: ownPhone }).eq('id', instance.id);
          console.log(`[webhook] Auto-set instance phone: ${instanceName} -> ${ownPhone}`);
        }
      }

      const pushName = msgData.pushName || '';
      const { text: messageText, mediaType, mediaUrl, mediaMime } = extractMessageContent(msgData.message, msgData);

      // Accept messages with text OR media (don't skip media-only messages)
      if (!messageText && !mediaType) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no content' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert contact
      let { data: contact } = await supabase
        .from('wa_contacts').select('id')
        .eq('instance_id', instance.id).eq('phone', phone).single();

      if (!contact) {
        const contactName = (!isFromMe && pushName && pushName !== phone) ? pushName : phone;
        const { data: newContact } = await supabase
          .from('wa_contacts')
          .insert({ instance_id: instance.id, phone, name: contactName })
          .select('id').single();
        contact = newContact;
      } else if (!isFromMe && pushName && pushName !== phone) {
        // Only update contact name from incoming messages (not from own profile name)
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
      const displayText = messageText || getMediaEmoji(mediaType);

      if (!conversation) {
        const { data: newConv } = await supabase
          .from('wa_conversations')
          .insert({
            contact_id: contact.id, instance_id: instance.id,
            assigned_to: instance.closer_id, assigned_role: 'closer',
            status: 'active', lead_status: 'novo',
            last_message: displayText, last_message_at: now,
            unread_count: isFromMe ? 0 : 1,
          })
          .select('id, unread_count').single();
        conversation = newConv;
      } else {
        await supabase.from('wa_conversations')
          .update({
            last_message: displayText, last_message_at: now,
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

      // Save media URL to storage if it's base64
      let finalMediaUrl = mediaUrl;
      if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
        try {
          finalMediaUrl = await saveBase64ToStorage(supabase, finalMediaUrl, mediaMime);
        } catch (e) {
          console.error('[webhook] Error saving base64 media:', e);
        }
      }

      await supabase.from('wa_messages').insert({
        conversation_id: conversation.id,
        instance_id: instance.id,
        sender: isFromMe ? 'agent' : 'contact',
        agent_name: isFromMe ? (msgData.pushName || 'Closer') : null,
        agent_id: isFromMe ? instance.closer_id : null,
        text: displayText,
        media_type: mediaType || null,
        media_url: finalMediaUrl || null,
        media_mime_type: mediaMime || null,
        created_at: msgData.messageTimestamp
          ? new Date(msgData.messageTimestamp * 1000).toISOString()
          : now,
      } as any);

      console.log('[webhook] Message saved:', isFromMe ? 'sent' : 'received', phone, mediaType || 'text', displayText.substring(0, 50));

      // Transcribe audio messages from contacts using Gemini
      let transcribedText = '';
      if (!isFromMe && mediaType === 'audio' && finalMediaUrl) {
        try {
          transcribedText = await transcribeAudio(finalMediaUrl, mediaMime);
          if (transcribedText) {
            console.log('[webhook] Audio transcribed:', transcribedText.substring(0, 100));
            // Update the saved message with transcription
            await supabase.from('wa_messages')
              .update({ text: `🎵 Áudio: "${transcribedText}"` })
              .eq('conversation_id', conversation.id)
              .eq('created_at', msgData.messageTimestamp
                ? new Date(msgData.messageTimestamp * 1000).toISOString()
                : now)
              .eq('sender', 'contact');
            // Also update conversation last_message
            await supabase.from('wa_conversations')
              .update({ last_message: `🎵 "${transcribedText.substring(0, 80)}"` })
              .eq('id', conversation.id);
          }
        } catch (transcErr) {
          console.error('[webhook] Audio transcription failed:', transcErr);
        }
      }

      // Determine effective message text (original text or transcription)
      const effectiveMessage = messageText !== '🎵 Áudio' && messageText !== '📷 Imagem' ? messageText : '';
      const aiTriggerMessage = transcribedText || effectiveMessage;

      // Trigger AI SDR agent for incoming messages from contacts
      // DEBOUNCE: Wait 3 seconds to allow batching of rapid sequential messages from the lead
      // The AI SDR agent will fetch recent messages from DB and combine them
      if (!isFromMe && instance.ai_sdr_enabled && aiTriggerMessage) {
        // Check if the sender is another managed WhatsApp instance
        const { data: senderInstance } = await supabase
          .from('wa_instances')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();

        if (senderInstance) {
          console.log('[webhook] Skipping AI SDR: sender is managed instance', phone);
        } else {
          // DEBOUNCE: Wait 3 seconds to batch rapid messages
          console.log('[webhook] Waiting 3s debounce before triggering AI SDR...');
          await new Promise(resolve => setTimeout(resolve, 3000));

          // After debounce, check if a NEWER message arrived (if so, skip - the newer webhook will handle it)
          const { data: newerMsgs } = await supabase
            .from('wa_messages')
            .select('id, created_at')
            .eq('conversation_id', conversation.id)
            .eq('sender', 'contact')
            .gt('created_at', msgData.messageTimestamp
              ? new Date(msgData.messageTimestamp * 1000).toISOString()
              : now)
            .limit(1);

          if (newerMsgs && newerMsgs.length > 0) {
            console.log('[webhook] Skipping AI SDR: newer message exists, letting that webhook handle it');
          } else {
            // Fetch all recent contact messages (last 30s) to batch them
            const batchWindow = new Date(Date.now() - 30000).toISOString();
            const { data: recentMsgs } = await supabase
              .from('wa_messages')
              .select('text')
              .eq('conversation_id', conversation.id)
              .eq('sender', 'contact')
              .gte('created_at', batchWindow)
              .order('created_at', { ascending: true });

            const batchedMessage = (recentMsgs || []).map(m => m.text).join('\n');

            try {
              const aiSdrUrl = `${SUPABASE_URL}/functions/v1/ai-sdr-agent`;
              const aiSdrResp = await fetch(aiSdrUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  conversation_id: conversation.id,
                  instance_id: instance.id,
                  contact_phone: phone,
                  instance_name: instanceName,
                  contact_name: pushName || phone,
                  incoming_message: batchedMessage || messageText,
                }),
              });
              const aiResult = await aiSdrResp.json();
              console.log('[webhook] AI SDR result:', JSON.stringify(aiResult).substring(0, 200));
            } catch (aiErr) {
              console.error('[webhook] AI SDR trigger failed:', aiErr);
            }
          }
        }
      }
    } // <-- close messages.upsert block

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

async function saveBase64ToStorage(supabase: any, base64Data: string, mimeType: string | null): Promise<string> {
  const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return base64Data;

  const mime = matches[1];
  const data = matches[2];
  const ext = mime.split('/')[1]?.split(';')[0] || 'bin';
  const fileName = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('wa-media')
    .upload(fileName, bytes, { contentType: mime, upsert: false });

  if (error) throw error;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  return `${SUPABASE_URL}/storage/v1/object/public/wa-media/${fileName}`;
}

function getMediaEmoji(mediaType: string | null): string {
  switch (mediaType) {
    case 'image': return '📷 Imagem';
    case 'video': return '🎥 Vídeo';
    case 'audio': return '🎵 Áudio';
    case 'sticker': return '🎨 Sticker';
    case 'document': return '📄 Documento';
    case 'location': return '📍 Localização';
    case 'contact': return '👤 Contato';
    default: return '';
  }
}

interface MediaContent {
  text: string;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
}

function extractMessageContent(message: Record<string, unknown>, msgData?: Record<string, unknown>): MediaContent {
  if (!message) return { text: '', mediaType: null, mediaUrl: null, mediaMime: null };

  const evolutionMediaUrl = (msgData as any)?.mediaUrl || null;

  if (typeof message.conversation === 'string') {
    return { text: message.conversation, mediaType: null, mediaUrl: null, mediaMime: null };
  }

  if (typeof message.extendedTextMessage === 'object' && message.extendedTextMessage) {
    return {
      text: (message.extendedTextMessage as Record<string, unknown>).text as string || '',
      mediaType: null, mediaUrl: null, mediaMime: null,
    };
  }

  if (typeof message.imageMessage === 'object' && message.imageMessage) {
    const img = message.imageMessage as Record<string, unknown>;
    return {
      text: (img.caption as string) || '📷 Imagem',
      mediaType: 'image',
      mediaUrl: evolutionMediaUrl || (img.url as string) || null,
      mediaMime: (img.mimetype as string) || 'image/jpeg',
    };
  }

  if (typeof message.videoMessage === 'object' && message.videoMessage) {
    const vid = message.videoMessage as Record<string, unknown>;
    return {
      text: (vid.caption as string) || '🎥 Vídeo',
      mediaType: 'video',
      mediaUrl: evolutionMediaUrl || (vid.url as string) || null,
      mediaMime: (vid.mimetype as string) || 'video/mp4',
    };
  }

  if (typeof message.audioMessage === 'object' && message.audioMessage) {
    const aud = message.audioMessage as Record<string, unknown>;
    return {
      text: '🎵 Áudio',
      mediaType: 'audio',
      mediaUrl: evolutionMediaUrl || (aud.url as string) || null,
      mediaMime: (aud.mimetype as string) || 'audio/ogg',
    };
  }

  if (typeof message.documentMessage === 'object' && message.documentMessage) {
    const doc = message.documentMessage as Record<string, unknown>;
    return {
      text: `📄 ${doc.fileName || 'Documento'}`,
      mediaType: 'document',
      mediaUrl: evolutionMediaUrl || (doc.url as string) || null,
      mediaMime: (doc.mimetype as string) || 'application/octet-stream',
    };
  }

  if (typeof message.stickerMessage === 'object' && message.stickerMessage) {
    const stk = message.stickerMessage as Record<string, unknown>;
    return {
      text: '🎨 Sticker',
      mediaType: 'sticker',
      mediaUrl: evolutionMediaUrl || (stk.url as string) || null,
      mediaMime: 'image/webp',
    };
  }

  if (typeof message.locationMessage === 'object') return { text: '📍 Localização', mediaType: 'location', mediaUrl: null, mediaMime: null };
  if (typeof message.contactMessage === 'object') return { text: '👤 Contato', mediaType: 'contact', mediaUrl: null, mediaMime: null };

  return { text: '', mediaType: null, mediaUrl: null, mediaMime: null };
}

async function transcribeAudio(audioUrl: string, mimeType: string | null): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[transcribe] LOVABLE_API_KEY not configured');
    return '';
  }

  try {
    // Fetch the audio file and convert to base64
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      console.error('[transcribe] Failed to fetch audio:', audioResp.status);
      return '';
    }

    const audioBuffer = await audioResp.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    let base64Audio = '';
    // Convert to base64 in chunks to avoid stack overflow
    const chunkSize = 8192;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.slice(i, i + chunkSize);
      base64Audio += String.fromCharCode(...chunk);
    }
    base64Audio = btoa(base64Audio);

    const mime = mimeType || 'audio/ogg';

    // Use Gemini Flash (supports audio natively) via Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem aspas, sem prefixos, sem explicações. Se o áudio estiver inaudível, retorne "áudio inaudível".',
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: mime.includes('ogg') ? 'ogg' : mime.includes('mp4') || mime.includes('m4a') ? 'mp4' : mime.includes('wav') ? 'wav' : 'ogg',
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[transcribe] AI gateway error:', response.status, errText);
      return '';
    }

    const data = await response.json();
    const transcription = data.choices?.[0]?.message?.content?.trim() || '';
    return transcription;
  } catch (err) {
    console.error('[transcribe] Error:', err);
    return '';
  }
}
