CREATE OR REPLACE FUNCTION public.protect_team_member_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.team_member_id IS NOT DISTINCT FROM OLD.team_member_id THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.team_member_id := OLD.team_member_id;
  RETURN NEW;
END;
$function$;