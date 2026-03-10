-- Push human agent messages older so the human_takeover window expires
UPDATE wa_messages 
SET created_at = '2026-03-10 10:00:00+00'
WHERE conversation_id = 'f85b72b0-d8e2-45f3-be24-bb4df93a3dec' 
AND sender = 'agent' 
AND agent_name != 'SDR IA 🤖';