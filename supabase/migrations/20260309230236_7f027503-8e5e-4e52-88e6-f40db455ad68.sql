
ALTER TABLE public.wa_instances 
  ADD COLUMN IF NOT EXISTS ai_sdr_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_sdr_config jsonb NOT NULL DEFAULT '{"greeting":"Olá! 👋 Obrigado por entrar em contato. Como posso ajudar você hoje?","tone":"profissional","auto_tag":true,"max_messages_before_handoff":10,"business_hours_only":false,"prompt_context":""}'::jsonb;
