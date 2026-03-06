
-- Enable pg_cron and pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Cron job to process event reminders every 2 minutes
SELECT cron.schedule(
  'process-event-reminders',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hnhykmvroeztyihoxpjc.supabase.co/functions/v1/process-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
