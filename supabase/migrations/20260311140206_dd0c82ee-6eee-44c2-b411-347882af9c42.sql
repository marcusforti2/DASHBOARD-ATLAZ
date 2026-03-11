UPDATE wa_instances 
SET 
  ai_sdr_enabled = true,
  ai_sdr_config = jsonb_set(
    COALESCE(ai_sdr_config, '{}'::jsonb),
    '{organic_mode_enabled}',
    'false'::jsonb
  )
WHERE true;