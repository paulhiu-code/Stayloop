/*
  Fix PMS secret column protection: table-level SELECT overrides column REVOKE
  in PostgreSQL, so re-grant SELECT only on safe columns.
  Also re-apply get_host_stripe_account restriction for anon.
*/

REVOKE SELECT ON public.pms_connections FROM authenticated, anon;

GRANT SELECT (
  id,
  user_id,
  pms_provider,
  account_name,
  is_active,
  oauth_expires_at,
  sync_settings,
  last_sync_at,
  sync_status,
  sync_error,
  created_at,
  updated_at
) ON public.pms_connections TO authenticated;

REVOKE ALL ON FUNCTION public.get_host_stripe_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_host_stripe_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_host_stripe_account(uuid) TO authenticated;
