/*
  Security hardening:
  - Hide PMS OAuth tokens and webhook secrets from client SELECT
  - Restrict get_host_stripe_account to authenticated users
  - Prevent profile user_type self-escalation
*/

-- PMS: authenticated users may write secrets but not read them via PostgREST
REVOKE SELECT (oauth_access_token, oauth_refresh_token, api_credentials, webhook_secret)
  ON public.pms_connections
  FROM authenticated;

REVOKE SELECT (oauth_access_token, oauth_refresh_token, api_credentials, webhook_secret)
  ON public.pms_connections
  FROM anon;

-- Stripe account lookup: require authenticated session (booking flow checks auth first)
REVOKE ALL ON FUNCTION public.get_host_stripe_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_stripe_account(uuid) TO authenticated;

-- Extend privileged-column trigger to block user_type escalation
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    NEW.is_admin := OLD.is_admin;
    NEW.stripe_account_id := OLD.stripe_account_id;
    NEW.stripe_onboarding_complete := OLD.stripe_onboarding_complete;
    NEW.stripe_charges_enabled := OLD.stripe_charges_enabled;
    NEW.stripe_payouts_enabled := OLD.stripe_payouts_enabled;

    IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
      -- Allow guests to explore hosting; block direct guest->host or other escalations
      IF NOT (OLD.user_type = 'guest' AND NEW.user_type = 'both') THEN
        NEW.user_type := OLD.user_type;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
