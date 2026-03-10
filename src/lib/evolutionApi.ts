import { supabase } from '@/integrations/supabase/client';

export interface EvolutionInstance {
  instanceName: string;
  instanceId?: string;
  status?: string;
  state?: string;
  profilePictureUrl?: string;
  owner?: string;
}

export interface QrCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

async function callEvolutionApi(action: string, instanceName?: string, data?: Record<string, unknown>) {
  const { data: response, error } = await supabase.functions.invoke('evolution-api', {
    body: { action, instanceName, data },
  });
  if (error) throw new Error(error.message);
  if (response?.error) throw new Error(typeof response.error === 'string' ? response.error : JSON.stringify(response.error));
  return response;
}

export async function listInstances(): Promise<EvolutionInstance[]> {
  const data = await callEvolutionApi('list');
  return Array.isArray(data) ? data : [];
}

export async function createInstance(instanceName: string, extra?: Record<string, unknown>): Promise<unknown> {
  return callEvolutionApi('create', instanceName, extra);
}

export async function connectInstance(instanceName: string): Promise<QrCodeResponse> {
  return callEvolutionApi('connect', instanceName);
}

export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  try {
    const data = await callEvolutionApi('status', instanceName);
    return data?.instance ?? data;
  } catch (err: unknown) {
    // Instance doesn't exist on Evolution API server — treat as disconnected
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || msg.includes('404')) {
      console.warn(`[evolutionApi] Instance "${instanceName}" not found on server`);
      return { state: 'close' };
    }
    throw err;
  }
}

export async function disconnectInstance(instanceName: string): Promise<void> {
  await callEvolutionApi('disconnect', instanceName);
}

export async function restartInstance(instanceName: string): Promise<void> {
  await callEvolutionApi('restart', instanceName);
}

export async function sendText(instanceName: string, phone: string, text: string): Promise<void> {
  await callEvolutionApi('sendText', instanceName, { number: phone, text });
}

export async function sendMedia(instanceName: string, phone: string, mediatype: 'image' | 'video' | 'document', mediaUrl: string, caption?: string, mimetype?: string): Promise<void> {
  await callEvolutionApi('sendMedia', instanceName, {
    number: phone,
    mediatype,
    media: mediaUrl,
    caption: caption || '',
    mimetype,
  });
}

export async function sendAudio(instanceName: string, phone: string, audioUrl: string): Promise<void> {
  await callEvolutionApi('sendWhatsAppAudio', instanceName, {
    number: phone,
    audio: audioUrl,
  });
}

export async function sendSticker(instanceName: string, phone: string, imageUrl: string): Promise<void> {
  await callEvolutionApi('sendSticker', instanceName, {
    number: phone,
    image: imageUrl,
  });
}

export function getWebhookUrl(instanceName?: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'hnhykmvroeztyihoxpjc';
  const base = `https://${projectId}.supabase.co/functions/v1/evolution-webhook`;
  return instanceName ? `${base}?instance=${instanceName}` : base;
}

export async function setWebhook(instanceName: string): Promise<unknown> {
  const webhookUrl = getWebhookUrl(instanceName);
  return callEvolutionApi('setWebhook', instanceName, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'CONTACTS_UPDATE',
        'CHATS_UPDATE',
      ],
    },
  });
}
