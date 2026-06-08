/*
  PMS webhook signing secret and tighter profile visibility.
*/

ALTER TABLE pms_connections
  ADD COLUMN IF NOT EXISTS webhook_secret text;

UPDATE pms_connections
SET webhook_secret = encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;

ALTER TABLE pms_connections
  ALTER COLUMN webhook_secret SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE pms_connections
  ALTER COLUMN webhook_secret SET NOT NULL;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE POLICY "Referrers can view referred profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (referred_by = auth.uid());

CREATE OR REPLACE FUNCTION public.lookup_referrer_id(p_referral_code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM profiles
  WHERE referral_code = upper(trim(p_referral_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_referrer_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_referrer_id(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_host_stripe_account(p_host_id uuid)
RETURNS TABLE(stripe_account_id text, stripe_charges_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.stripe_account_id::text, p.stripe_charges_enabled
  FROM profiles p
  WHERE p.id = p_host_id
    AND EXISTS (
      SELECT 1
      FROM properties prop
      WHERE prop.host_id = p.id
        AND prop.is_active = true
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_host_stripe_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_host_stripe_account(uuid) TO authenticated, anon;
