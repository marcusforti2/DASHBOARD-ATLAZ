
ALTER TABLE public.wa_messages
  ADD COLUMN media_type text DEFAULT NULL,
  ADD COLUMN media_url text DEFAULT NULL,
  ADD COLUMN media_mime_type text DEFAULT NULL;
