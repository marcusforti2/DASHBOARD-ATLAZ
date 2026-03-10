UPDATE wa_instances 
SET ai_sdr_config = jsonb_set(
  ai_sdr_config::jsonb, 
  '{rate_limit_exempt_conversations}', 
  '["f85b72b0-d8e2-45f3-be24-bb4df93a3dec"]'::jsonb
) 
WHERE id = '8a2de57e-bf3e-40bf-81a7-59b6855f935d';