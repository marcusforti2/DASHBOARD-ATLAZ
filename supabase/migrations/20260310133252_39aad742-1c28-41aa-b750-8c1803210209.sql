
-- Fix: wa_contacts SELECT policy too restrictive for SDR/Closer users
-- Conversations are readable by all authenticated, so contacts should be too
DROP POLICY IF EXISTS "Authenticated read wa_contacts" ON public.wa_contacts;

CREATE POLICY "Authenticated read wa_contacts"
ON public.wa_contacts
FOR SELECT
TO authenticated
USING (true);
