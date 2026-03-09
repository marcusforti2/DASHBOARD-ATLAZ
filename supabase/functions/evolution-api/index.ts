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
