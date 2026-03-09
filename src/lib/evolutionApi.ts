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
  const data = await callEvolutionApi('status', instanceName);
  return data?.instance ?? data;
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
