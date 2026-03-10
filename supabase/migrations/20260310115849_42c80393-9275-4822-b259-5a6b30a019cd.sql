INSERT INTO wa_conversations (contact_id, instance_id, lead_status, status)
VALUES (
  'da7e0e50-448b-4c5d-b146-f5d8a892ad29',
  '8a2de57e-bf3e-40bf-81a7-59b6855f935d',
  'novo',
  'open'
) RETURNING id;