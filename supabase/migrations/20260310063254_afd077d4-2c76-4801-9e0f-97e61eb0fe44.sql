UPDATE wa_instances
SET 
  ai_sdr_config = (SELECT ai_sdr_config FROM wa_instances WHERE instance_name = 'wpp_marcus_forti_n' LIMIT 1),
  ai_sdr_enabled = true
WHERE instance_name IN ('wpp_alex', 'wpp_jacob', 'wpp_marcus');