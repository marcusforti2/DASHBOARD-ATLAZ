
-- Fix missing pipedrive_label_id for Dripify (40) and Indicação (27) on wpp_marcus
UPDATE wa_instances
SET ai_sdr_config = jsonb_set(
  jsonb_set(
    ai_sdr_config::jsonb,
    '{lead_sources,1,pipedrive_label_id}',
    '40'
  ),
  '{lead_sources,2,pipedrive_label_id}',
  '27'
)
WHERE instance_name = 'wpp_marcus';
