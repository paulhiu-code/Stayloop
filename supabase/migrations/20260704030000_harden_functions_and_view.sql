/*
  Security hardening follow-up (resolves Supabase security advisors):
  - Convert property_review_stats to SECURITY INVOKER (fixes security_definer_view ERROR)
  - Make trigger_referral_commissions run as owner so its RPC can be locked down
  - Revoke client (anon/authenticated/PUBLIC) EXECUTE on trigger-only and
    internal SECURITY DEFINER functions (they still fire via triggers / definer callers)
  - Pin search_path on functions flagged function_search_path_mutable

  Left intentionally executable by anon/authenticated (legitimate public/RLS use):
  search_properties, lookup_referrer_id, is_admin_user.
*/

-- 1. SECURITY DEFINER view -> SECURITY INVOKER
ALTER VIEW public.property_review_stats SET (security_invoker = true);

-- 2. Referral-commission trigger: run as owner so the internal PERFORM does not
--    require the invoking (authenticated) user to hold EXECUTE on the callee.
CREATE OR REPLACE FUNCTION public.trigger_referral_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    PERFORM calculate_referral_commissions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger-only functions: remove RPC exposure. Triggers still fire because the
--    trigger mechanism invokes them independently of these EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_stayloop_booking_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_email_template_revision() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_referral_commissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_booking_mirror_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_email_trigger_updated_at() FROM PUBLIC, anon, authenticated;

-- 4. Internal SECURITY DEFINER helpers only invoked from the (SECURITY DEFINER)
--    booking-sync trigger or the referral trigger. The definer/owner context
--    retains EXECUTE, so revoking client roles is safe.
REVOKE EXECUTE ON FUNCTION public.calculate_referral_commissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_calendar_for_booking(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unblock_calendar_for_booking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_pms_outbound_job(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- 5. Pin search_path (prevents search_path hijacking) on functions still flagged mutable.
ALTER FUNCTION public.calculate_referral_commissions(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.escape_like_pattern(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_referral_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.pms_booking_is_blocking(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.protect_profile_privileged_columns() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_booking_mirror_columns() SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_email_trigger_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
