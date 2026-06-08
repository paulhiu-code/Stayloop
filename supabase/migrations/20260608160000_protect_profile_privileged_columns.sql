/*
  Prevent non-admin users from escalating privileges or mutating Stripe fields.
*/

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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();
